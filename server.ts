import express from "express";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { randanimal } from "randanimal";
import slugify from "slugify";

dotenv.config();

const accountId = <string>process.env.ACCOUNT_ID;
const username = <string>process.env.USERNAME;
const password = <string>process.env.PASSWORD;

const voiceNumber = <string>process.env.VOICE_NUMBER;
const voiceAppId = <string>process.env.VOICE_APP_ID;
const voiceCallbackUrl = <string>process.env.VOICE_CALLBACK_URL;

const port = process.env.PORT || 3000;
const httpServerUrl = <string>process.env.WEBRTC_HTTP_SERVER_URL;
const websocketDeviceUrl = <string>process.env.WEBRTC_DEVICE_URL;
const sipDestination = <string>process.env.SIP_DESTINATION;

const app = express();

const generateTransferBxml = (conferenceId: string, participantId: string) => {
  return `<Transfer transferCallerId="+1${conferenceId}${participantId}"><PhoneNumber>${sipDestination}</PhoneNumber></Transfer>`;
}

app.use(cors());
app.use(bodyParser.json());

/**
 * Used for load balancer health checks
 */
app.get("/ping", (req, res) => {
  res.send("OK");
});

app.post("/callback/:conferenceId/:participantId", async (req, res) => {
  console.log(
    `received callback to /callback/${req.params.conferenceId}/${
      req.params.participantId
    }, body: ${JSON.stringify(req.body)}`
  );
  const conferenceId = req.params.conferenceId;
  const participantId = req.params.participantId;
  console.log(
    `received callback to add ${participantId} to conference ${conferenceId}`
  );
  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <SpeakSentence voice="julie">Welcome to Bandwidth WebRTC Conferencing. Please wait while we connect you to your conference.</SpeakSentence>
      ${generateTransferBxml(conferenceId, participantId)}
  </Response>`;
  console.log(`replying with bxml: ${bxml}`);
  res.contentType("application/xml").send(bxml);
});

app.post("/callback/incoming", async (req, res) => {
  console.log(
    `received callback to /callback/incoming, body: ${JSON.stringify(req.body)}`
  );
  console.log(`new incoming call from ${req.body.from}`);
  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <Gather maxDigits="7" gatherUrl="${voiceCallbackUrl}/joinConference">
        <SpeakSentence voice="julie">Welcome to Bandwidth WebRTC Conferencing. Please enter your 7 digit conference ID.</SpeakSentence>
      </Gather>
  </Response>`;
  console.log(`replying with bxml: ${bxml}`);
  res.contentType("application/xml").send(bxml);
});

app.post("/callback/status", (req, res) => {
  console.log(`received call status update: ${JSON.stringify(req.body)}`);
  res.status(200).send();
});

interface Conference {
  id: string;
  name: string;
  slug: string;
  participants: Map<string, Participant>;
}

interface Participant {
  id: string;
  status: string;
  name?: string;
  streams: string[];
}

const slugsToIds: Map<string, string> = new Map(); // Conference slug to conference id
const conferences: Map<string, Conference> = new Map(); // Conference id to conference

const createConference = async (slug: string, name = "") => {
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

  let conferenceId = response.data.id;  
  console.log("created conference", conferenceId);
  const conference: Conference = {
    id: conferenceId,
    name: name,
    slug: slug,
    participants: new Map(),
  };

  conferences.set(conferenceId, conference);
  slugsToIds.set(slug, conferenceId);
  return conference;
};

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

    const conference = await createConference(slug, name);
    res.status(200).send({
      id: conference.id,
      name: conference.name,
      slug: conference.slug,
    });
  } catch (e) {
    res.status(400).send(e);
  }
});

app.post("/conferences/:slug/participants", async (req, res) => {
  try {
    const slug = req.params.slug;

    let conference = null;
    let conferenceId = slugsToIds.get(slug);
    if (conferenceId) {
      conference = conferences.get(conferenceId);
    }

    if (!conference) {
      conference = await createConference(slug);
      conferenceId = conference.id;
    }
    conferenceId = conferenceId as string;

    // Create participant
    let createParticipantResponse = await axios.post(
      `${httpServerUrl}/accounts/${accountId}/participants`,
      {
        callbackUrl: "https://example.com",
        publishPermissions: ["AUDIO", "VIDEO"],
        tag: slug
      },
      {
        auth: {
          username: username,
          password: password
        }
      }
    )

    let participant = createParticipantResponse.data.participant;
    let token = createParticipantResponse.data.token;

    // Add participant to session
    await axios.put(
      `${httpServerUrl}/accounts/${accountId}/sessions/${conferenceId}/participants/${participant.id}`,
      {
        sessionId: conferenceId
      },
      {
        auth: {
          username: username,
          password: password
        }
      }
    )

    conference.participants.set(participant.id, {
      id: participant.id,
      status: "pending",
      name: req.body.name,
      streams: [],
    });

    const phoneNumber = req.body.phoneNumber;
    if (phoneNumber) {
      callPhoneNumber(
        phoneNumber,
        conferenceId,
        participant.id
      );
    }
    res.status(200).send({
      websocketUrl: websocketDeviceUrl,
      conferenceId: conferenceId,
      participantId: participant.id,
      deviceToken: token,
      phoneNumber: voiceNumber,
    });
  } catch (e) {
    console.log("exception", e);
    res.status(400).send(e);
  }
});

const callPhoneNumber = async (
  phoneNumber: string,
  conferenceId: string,
  participantId: string
) => {
  let response = await axios.post(
    `https://voice.bandwidth.com/api/v2/accounts/${accountId}/calls`,
    {
      from: voiceNumber,
      to: phoneNumber,
      answerUrl: `${voiceCallbackUrl}/${conferenceId}/${participantId}`,
      applicationId: voiceAppId,
    },
    {
      auth: {
        username: username,
        password: password,
      },
    }
  );
  console.log(response.data);
  console.log(`ringing ${phoneNumber}...`);
};

app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

app.listen(port, async () => {
  console.log(`Server is listening on port ${port}`);
});
