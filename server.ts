import express from "express";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { randanimal } from "randanimal";
import slugify from "slugify";
import session from "express-session";
import { ExpressOIDC } from "@okta/oidc-middleware";
import { ApiController as WebRtcController } from "@bandwidth/webrtc";

dotenv.config();

const accountId = <string>process.env.ACCOUNT_ID;
const username = <string>process.env.USERNAME;
const password = <string>process.env.PASSWORD;

const voiceNumber = <string>process.env.VOICE_NUMBER;

const baseCallbackUrl = <string>process.env.CALLBACK_URL;
const webrtcCallbackPath = "/callback/webrtc";

const port = process.env.PORT || 5000;
const httpServerUrl = <string>process.env.WEBRTC_HTTP_SERVER_URL || "https://api.webrtc.bandwidth.com/v1";
const websocketDeviceUrl = <string>process.env.WEBRTC_DEVICE_URL || "wss://device.webrtc.bandwidth.com";
const sipTransferUrl = <string>process.env.SIP_TRANSFER_URL || "sip:sipx.webrtc.bandwidth.com:5060";

const oktaClientId = <string>process.env.OKTA_CLIENT_ID;
const oktaClientSecret = <string>process.env.OKTA_CLIENT_SECRET;
const oktaIssuerUrl = <string>process.env.OKTA_ISSUER_URL;
const appBaseUrl = <string>process.env.APP_BASE_URL;

const conferenceCodeLength = 3;
const participantLifetimeMillis = 9 * 60 * 60 * 1000; // 9 hours

// Check to make sure required environment variables are set
if (!accountId || !username || !password) {
  console.error(
      "ERROR! Please set the ACCOUNT_ID, USERNAME, and PASSWORD environment variables before running this app"
  );
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(bodyParser.json());

/**
 * Used for load balancer health checks
 */
app.get("/ping", (req, res) => {
  res.send("OK");
});


/**
* If OKTA_CLIENT_ID is set, we'll use ExpressOIDC to limit use of this app to 
* those who can auth via Okta
*/
let oidc = null;
if (oktaClientId) {
  app.use(
    session({
      secret: oktaClientSecret,
      resave: true,
      saveUninitialized: false,
    })
  );

  oidc = new ExpressOIDC({
    issuer: oktaIssuerUrl,
    client_id: oktaClientId,
    client_secret: oktaClientSecret,
    redirect_uri: `${appBaseUrl}/authorization-code/callback`,
    scope: "openid profile",
    appBaseUrl: appBaseUrl,
  });
  
  // ExpressOIDC will attach handlers for the /login and /authorization-code/callback routes
  app.use(oidc.router);
  app.use("/", oidc.ensureAuthenticated());
  app.use("/conferences", oidc.ensureAuthenticated());
  app.use("/conferences/*", oidc.ensureAuthenticated());
  console.log('Using Okta authentication')
}

const slugsToIds: Map<string, string> = new Map(); // Conference slug to session id
const sessionIdsToSlugs: Map<string, string> = new Map(); // Session id to slug
const conferenceCodeToIds: Map<string, string> = new Map(); // Conference code to session id
const sessionIdsToConferenceCodes: Map<string, string> = new Map(); // Session id to conference code
const participantIdsToSessionIds: Map<string, string> = new Map(); // Participant id to session id they are in
const sessionIdsToParticipantIds: Map<string, Set<string>> = new Map(); // Session id to set of participant ids in the session
const participantIdsToCleanupTimeouts: Map<string, NodeJS.Timeout> = new Map(); // Participant ids to timeouts which will cleanup said participants

const createConference = async (slug: string): Promise<string> => {
  // Create session
  let response = await axios.post(
    `${httpServerUrl}/accounts/${accountId}/sessions`,
    {
      tag: slug
    },
    {
      auth: {
        username: username,
        password: password
      }
    }
  )
  let sessionId = response.data.id;

  slugsToIds.set(slug, sessionId);
  sessionIdsToSlugs.set(sessionId, slug);
  let freeConferenceCode = undefined;
  while(!freeConferenceCode || conferenceCodeToIds.has(freeConferenceCode)) {
    freeConferenceCode = Math.random().toString().slice(2,2+conferenceCodeLength);
  }
  conferenceCodeToIds.set(freeConferenceCode, sessionId);
  sessionIdsToConferenceCodes.set(sessionId, freeConferenceCode);
  sessionIdsToParticipantIds.set(sessionId, new Set());
  return sessionId;
};

const getConference = async (conferenceId: string): Promise<string> => {
  return axios.get(
    `${httpServerUrl}/accounts/${accountId}/sessions/${conferenceId}`,
    {
      auth: {
        username: username,
        password: password
      }
    }
  );
}

const deleteConference = async (conferenceId: string) => {
  console.log(`Deleting conference ${conferenceId}`);
  try {
    await axios.delete(
      `${httpServerUrl}/accounts/${accountId}/sessions/${conferenceId}`,
      {
        auth: {
          username: username,
          password: password
        }
      }
    );
    } catch (err) {
      console.log(`Error deleting session ${conferenceId}`, err.response.data);
    }
}

const createParticipant = async (slug: string, version: string, publishPermissions: string[]) => {
  let createParticipantResponse = await axios.post(
      `${httpServerUrl}/accounts/${accountId}/participants`,
      {
        callbackUrl: `${baseCallbackUrl}${webrtcCallbackPath}`,
        publishPermissions: publishPermissions,
        tag: slug,
        deviceApiVersion: version,
      },
      {
        auth: {
          username: username,
          password: password
        }
      }
  )

  const participant = createParticipantResponse.data.participant;
  const deviceToken = createParticipantResponse.data.token;

  // Set a timeout to clean this participant up later in case we don't receive an onLeave callback
  const timeout = setTimeout(() => {
    cleanupParticipant(participant.id);
  }, participantLifetimeMillis);
  participantIdsToCleanupTimeouts.set(participant.id, timeout);

  return {
    participant,
    deviceToken,
  }
};

const addParticipantToSession = async (participantId: string, sessionId: string) => {
  // Add participant to session
  await axios.put(
      `${httpServerUrl}/accounts/${accountId}/sessions/${sessionId}/participants/${participantId}`,
      {
        sessionId: sessionId
      },
      {
        auth: {
          username: username,
          password: password
        }
      }
  )

  participantIdsToSessionIds.set(participantId, sessionId);
  sessionIdsToParticipantIds.get(sessionId)?.add(participantId);
}

const removeParticipantFromSession = async (participantId: string, sessionId: string) => {
  console.log(`Removing participant ${participantId} from session ${sessionId}`);
  try {
    await axios.delete(
        `${httpServerUrl}/accounts/${accountId}/sessions/${sessionId}/participants/${participantId}`,
        {
          auth: {
            username: username,
            password: password
          }
        }
    )
  } catch (err) {
    console.log(`Error removing participant ${participantId} from session ${sessionId}`, err.response.data);
  }
}

const deleteParticipant = async (participantId: string) => {
  console.log(`Deleting participant ${participantId}`);
  try {
    await axios.delete(
        `${httpServerUrl}/accounts/${accountId}/participants/${participantId}`,
        {
          auth: {
            username: username,
            password: password
          }
        }
    )
  } catch (err) {
    console.log(`Error deleting participant ${participantId}`, err.response.data);
  }
};

/**
 * Delete a partipant from the WebRTC platform as well as all local maps
 * If there aren't any participants left in the session this participant was in, clean the session up too
 * @param participantId participant id
 */
const cleanupParticipant = async (participantId: string) => {
  console.log(`Cleaning up participant ${participantId}`);
  participantIdsToCleanupTimeouts.delete(participantId);
  const sessionId = participantIdsToSessionIds.get(participantId);
  participantIdsToSessionIds.delete(participantId);

  if (sessionId) {
    await removeParticipantFromSession(participantId, sessionId);
  }

  await deleteParticipant(participantId);
  
  if (sessionId) {
    const participantIds = sessionIdsToParticipantIds.get(sessionId);
    participantIds?.delete(participantId);
    if (!participantIds || participantIds.size === 0) {
      await cleanupSession(sessionId);
    }
  }
}

/**
 * Delete a session from the WebRTC platform as well as all local maps
 * @param sessionId session id
 */
const cleanupSession = async (sessionId: string) => {
  console.log(`Cleaning up session ${sessionId}`);
  sessionIdsToParticipantIds.delete(sessionId);
  
  const conferenceCode = sessionIdsToConferenceCodes.get(sessionId);
  sessionIdsToConferenceCodes.delete(sessionId);
  if (conferenceCode) {
    conferenceCodeToIds.delete(conferenceCode);
  }

  const slug = sessionIdsToSlugs.get(sessionId);
  sessionIdsToSlugs.delete(sessionId);
  if (slug) {
    slugsToIds.delete(slug);
  }

  await deleteConference(sessionId);
}

app.post("/conferences", async (req, res) => {
  try {
    console.log("creating conference", req.body);
    let name = req.body.name;
    if (!name) {
      // Generate a random name
      name = await randanimal();
    }

    const slug = slugify(name).toLowerCase();
    console.log("using slug", slug);
    if (slugsToIds.has(slug)) {
      let conferenceId = slugsToIds.get(slug)!;
      try {
        await getConference(conferenceId);
        return res.status(200).send({
          id: conferenceId,
          slug: slug,
        });
      } catch (e) {
        slugsToIds.delete(slug);
      }
    }

    let conferenceId = await createConference(slug);
    return res.status(200).send({
      id: conferenceId,
      slug: slug,
    });
  } catch (e) {
    console.log('Error creating conference', e);
    return res.status(400).send();
  }
});

app.post("/conferences/:slug/participants", async (req, res) => {
  try {
    const version = req.query.version || "v3";
    const slug = req.params.slug;
    let conferenceId = slugsToIds.get(slug);
    if (conferenceId) {
      try {
        // Ensure the conference id we have mapped is still valid
        console.log(`checking validity of conference ${conferenceId}`);
        await getConference(conferenceId);
      } catch (e) {
        console.log(`conference ${conferenceId} is invalid, removing mapping`);
        conferenceId = undefined;
        slugsToIds.delete(slug);
      }
    }

    if (!conferenceId) {
      // Create a new conference for this slug
      conferenceId = await createConference(slug);
      console.log(`created new conference ${conferenceId} for slug ${slug}`);
    }

    console.log(`using conferenceId ${conferenceId} for slug ${slug}`);

    let createParticipantResponse = await createParticipant(slug, version, ["AUDIO", "VIDEO"]);
    let participant = createParticipantResponse.participant;
    let token = createParticipantResponse.deviceToken;

    await addParticipantToSession(participant.id, conferenceId)

    res.status(200).send({
      websocketUrl: websocketDeviceUrl,
      conferenceCode: sessionIdsToConferenceCodes.get(conferenceId),
      conferenceId: conferenceId,
      participantId: participant.id,
      deviceToken: token,
      phoneNumber: voiceNumber
    });
  } catch (e) {
    console.log('Error creating participant', e);
    res.status(400).send();
  }
});

app.post(webrtcCallbackPath, async (req, res) => {
  const payload = req.body;
  console.log(`Received WebRTC callback (${Date.now() - payload.timestamp}ms delay)`, payload);
  res.status(200).send();
  if (payload.event === "onLeave") {
    const participantId = payload.participantId;

    // Clear the participant cleanup timeout since we know we don't need it
    const timeout = participantIdsToCleanupTimeouts.get(participantId);
    if (timeout) {
      clearTimeout(timeout);
    }
    await cleanupParticipant(participantId);
  }
});

app.post("/callback/incoming", async (req, res) => {
  console.log(
      `received callback to /callback/incoming, body: ${JSON.stringify(req.body)}`
  );
  console.log(`new incoming call from ${req.body.from}`);
  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <Gather maxDigits="${conferenceCodeLength}" gatherUrl="${baseCallbackUrl}/callback/joinConference">
        <SpeakSentence voice="julie">Welcome to Bandwidth WebRTC Conferencing. Please enter your ${conferenceCodeLength} digit conference ID.</SpeakSentence>
      </Gather>
  </Response>`;
  console.log(`replying with bxml: ${bxml}`);
  res.contentType("application/xml").send(bxml);
});

app.post("/callback/status", (req, res) => {
  console.log(`received call status update: ${JSON.stringify(req.body)}`);
  res.status(200).send();
});

app.post("/callback/joinConference", async (req, res) => {
  console.log(
      `received callback to /callback/joinConference, body: ${JSON.stringify(
          req.body
      )}`
  );
  console.log(req.body.digits);
  let conferenceCode = req.body.digits;
  let sessionId = conferenceCodeToIds.get(conferenceCode);
  let callId = req.body.callId;
  console.log(
      `${req.body.from} is attempting to join conference code ${conferenceCode}, session id ${sessionId}, voice call ID ${callId}`
  );

  if (!sessionId) {
    console.log(`conferenceCode ${conferenceCode} not found`);
    res.status(400).send();
    return;
  }
  let slug: string = sessionIdsToSlugs.get(sessionId)!;

  let createParticipantResponse = await createParticipant(slug, "v3", ["AUDIO"]);
  let participant = createParticipantResponse.participant;
  let token = createParticipantResponse.deviceToken;

  await addParticipantToSession(participant.id, sessionId)

  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <SpeakSentence voice="julie">Thank you. Connecting you to your conference now.</SpeakSentence>
      ${WebRtcController.generateTransferBxmlVerb(token, callId, sipTransferUrl)}
  </Response>`;
  console.log(`replying with bxml: ${bxml}`);
  res.contentType("application/xml").send(bxml);
  console.log("transferring call");
});

app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

app.listen(port, async () => {
  console.log(`Server is listening on port ${port}`);
});
