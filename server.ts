import express from "express";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { randanimal } from "randanimal";
import slugify from "slugify";
import jwt_decode from "jwt-decode";

dotenv.config();

const accountId = <string>process.env.ACCOUNT_ID;
const username = <string>process.env.USERNAME;
const password = <string>process.env.PASSWORD;

const sipxNumber = <string>process.env.WEBRTC_SIPX_NUMBER;
const voiceNumber = <string>process.env.VOICE_NUMBER;
const voiceAppId = <string>process.env.VOICE_APP_ID;
const voiceCallbackUrl = <string>process.env.VOICE_CALLBACK_URL;

const port = process.env.PORT || 3000;
const httpServerUrl = <string>process.env.WEBRTC_HTTP_SERVER_URL;
const websocketDeviceUrl = <string>process.env.WEBRTC_DEVICE_URL;

const conferenceCodeLength = 3;


const app = express();

app.use(cors());
app.use(bodyParser.json());

/**
 * Used for load balancer health checks
 */
app.get("/ping", (req, res) => {
  res.send("OK");
});

const slugsToIds: Map<string, string> = new Map(); // Conference slug to session id
const sessionIdsToSlugs: Map<string, string> = new Map(); // Session id to slug
const conferenceCodeToIds: Map<string, string> = new Map(); // Conference code to session id
const sessionIdsToConferenceCodes: Map<string, string> = new Map(); // Session id to conference code

const generateTransferBxml = async (deviceToken: string) => {
  //Get the tid out of the participant jwt
  let decoded = jwt_decode(deviceToken);
  return `<Transfer transferCallerId="${decoded.tid}"><PhoneNumber>${sipxNumber}</PhoneNumber></Transfer>`;
}

const createConference = async (slug: string) => {
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
  console.log(`createConference response`, response.status, response.data);

  let sessionId = response.data.id;

  slugsToIds.set(slug, sessionId);
  sessionIdsToSlugs.set(sessionId, slug);
  let freeConferenceCode = undefined;
  while(!freeConferenceCode || conferenceCodeToIds.has(freeConferenceCode)) {
    freeConferenceCode = Math.random().toString().slice(2,2+conferenceCodeLength);
  }
  conferenceCodeToIds.set(freeConferenceCode, sessionId);
  sessionIdsToConferenceCodes.set(sessionId, freeConferenceCode);
  return sessionId;
};

const createParticipant = async (slug: string, publishPermissions: string[]) => {
  let createParticipantResponse = await axios.post(
      `${httpServerUrl}/accounts/${accountId}/participants`,
      {
        callbackUrl: "https://example.com",
        publishPermissions: publishPermissions,
        tag: slug
      },
      {
        auth: {
          username: username,
          password: password
        }
      }
  )

  return {
    participant: createParticipantResponse.data.participant,
    deviceToken: createParticipantResponse.data.token
  };
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
      res.status(409).send();
      return;
    }

    const conferenceId = await createConference(slug);
    res.status(200).send({
      id: conferenceId,
      slug: slug,
    });
  } catch (e) {
    res.status(400).send(e);
  }
});

app.post("/conferences/:slug/participants", async (req, res) => {
  try {
    const slug = req.params.slug;

    let conferenceId = slugsToIds.get(slug);
    if (conferenceId) {
      try {
        // Ensure the conference id we have mapped is still valid
        await axios.get(
          `${httpServerUrl}/accounts/${accountId}/sessions/${conferenceId}`,
          {
            auth: {
              username: username,
              password: password
            }
          }
        );
      } catch (e) {
        conferenceId = undefined;
      }
    }
    
    if (!conferenceId) {
      // Create a new conference for this slug
      conferenceId = await createConference(slug);
      console.log(`created new conference ${conferenceId} for slug ${slug}`);
    }

    console.log(`using conferenceId ${conferenceId} for slug ${slug}`);

    let createParticipantResponse = await createParticipant(slug, ["AUDIO", "VIDEO"]);
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
    console.log("exception", e);
    res.status(400).send(e);
  }
});

app.post("/callback/incoming", async (req, res) => {
  console.log(
      `received callback to /callback/incoming, body: ${JSON.stringify(req.body)}`
  );
  console.log(`new incoming call from ${req.body.from}`);
  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <Gather maxDigits="${conferenceCodeLength}" gatherUrl="${voiceCallbackUrl}/joinConference">
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
  console.log(
      `${req.body.from} is attempting to join conference code ${conferenceCode}, session id ${sessionId}`
  );

  if (!sessionId) {
    console.log(`conferenceCode ${conferenceCode} not found`);
    res.status(400).send();
    return;
  }
  let slug = sessionIdsToSlugs.get(sessionId)

  let createParticipantResponse = await createParticipant(slug, ["AUDIO"]);
  let participant = createParticipantResponse.participant;
  let token = createParticipantResponse.deviceToken;

  await addParticipantToSession(participant.id, sessionId)

  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <SpeakSentence voice="julie">Thank you. Connecting you to your conference now.</SpeakSentence>
      ${await generateTransferBxml(token)}
  </Response>`;
  console.log(`replying with bxml: ${bxml}`);
  res.contentType("application/xml").send(bxml);
  console.log("transferring call");
});
////
app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

app.listen(port, async () => {
  console.log(`Server is listening on port ${port}`);
});
