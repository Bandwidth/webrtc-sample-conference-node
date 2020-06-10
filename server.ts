import express from "express";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { randanimal } from "randanimal";
import slugify from "slugify";
import BandwidthRtc, {
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  ParticipantPublishedEvent,
  ParticipantUnsubscribedEvent,
} from "@bandwidth/webrtc-node-sdk";

dotenv.config();

const accountId = <string>process.env.ACCOUNT_ID;
const username = <string>process.env.USERNAME;
const password = <string>process.env.PASSWORD;

const voiceNumber = <string>process.env.VOICE_NUMBER;
const voiceAppId = <string>process.env.VOICE_APP_ID;
const voiceCallbackUrl = <string>process.env.VOICE_CALLBACK_URL;

const port = process.env.PORT || 3000;
const websocketServerUrl = <string>process.env.WEBRTC_SERVER_URL;
const websocketDeviceUrl = <string>process.env.WEBRTC_DEVICE_URL;
const sipDestination = <string>process.env.SIP_DESTINATION;

const eventFilter = <string>process.env.WEBRTC_EVENT_FILTER;

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
 * V2 voice callbacks need to be outside of Okta
 */
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
      ${bandwidthRtc.generateTransferBxml(conferenceId, participantId)}
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

app.post("/callback/joinConference", async (req, res) => {
  console.log(
    `received callback to /callback/joinConference, body: ${JSON.stringify(
      req.body
    )}`
  );
  const conferenceId = req.body.digits;
  console.log(
    `${req.body.from} is attempting to join conference ${conferenceId}`
  );

  let conference = conferences.get(conferenceId);
  if (!conference) {
    console.log(`conference ${conferenceId} not found`);
    res.status(400).send();
    return;
  }

  let participantResponse = await bandwidthRtc.createParticipant(conferenceId);
  conference.participants.set(participantResponse.participantId, {
    id: participantResponse.participantId,
    status: "pending",
    name: req.body.from,
    streams: [],
  });

  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <SpeakSentence voice="julie">Thank you. Connecting you to your conference now.</SpeakSentence>
      ${bandwidthRtc.generateTransferBxml(
        conferenceId,
        participantResponse.participantId
      )}
  </Response>`;
  console.log(`replying with bxml: ${bxml}`);
  res.contentType("application/xml").send(bxml);
  console.log("transferring call");
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

const bandwidthRtc = new BandwidthRtc();
let options: any = {};
if (websocketServerUrl) {
  options.websocketUrl = websocketServerUrl;
}
if (sipDestination) {
  options.sipDestination = sipDestination;
}
if (eventFilter) {
  options.eventFilter = eventFilter;
}
bandwidthRtc
  .connect(
    {
      accountId: accountId,
      username: username,
      password: password,
    },
    options
  )
  .then(() => {
    console.log("bandwidth rtc websocket connected");
  });

const createConference = async (slug: string, name = "") => {
  let conferenceId = await bandwidthRtc.startConference();
  console.log("created conference", conferenceId);
  const conference: Conference = {
    id: conferenceId,
    name: name,
    slug: slug,
    participants: new Map(),
  };

  conferences.set(conferenceId, conference);
  slugsToIds.set(slug, conferenceId);
  console.log("conferenceMap", conferences);
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
    console.log("createParticipant", req.params, req.body);
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

    let participantResponse = await bandwidthRtc.createParticipant(
      conferenceId
    );
    conference.participants.set(participantResponse.participantId, {
      id: participantResponse.participantId,
      status: "pending",
      name: req.body.name,
      streams: [],
    });

    console.log("conference updated", conference);

    const phoneNumber = req.body.phoneNumber;
    if (phoneNumber) {
      callPhoneNumber(
        phoneNumber,
        conferenceId,
        participantResponse.participantId
      );
    }
    res.status(200).send({
      websocketUrl: websocketDeviceUrl,
      conferenceId: conferenceId,
      participantId: participantResponse.participantId,
      deviceToken: participantResponse.deviceToken,
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

bandwidthRtc.onParticipantJoined(async (event: ParticipantJoinedEvent) => {
  console.log(
    `participant ${event.participantId} joined conference ${event.conferenceId}`
  );
  await subscribeParticipantToAllStreams(
    event.conferenceId,
    event.participantId
  );
});

bandwidthRtc.onParticipantLeft(async (event: ParticipantLeftEvent) => {
  console.log(
    `participant ${event.participantId} left conference ${event.conferenceId}`
  );
  const conferenceId = event.conferenceId;
  const participantId = event.participantId;
  const conference = conferences.get(conferenceId);
  if (conference) {
    // Remove the participant from the conference
    await bandwidthRtc.removeParticipant(conferenceId, participantId);
    // Remove the participant from our local state
    conference.participants.delete(participantId);
    // If everyone has left the conference, let's shut it down
    if (conference.participants.size === 0) {
      slugsToIds.delete(conference.slug);
      await bandwidthRtc.endConference(conferenceId);
      conferences.delete(conferenceId);
      console.log(`ended conference ${conferenceId}`);
    }
  }
});

bandwidthRtc.onParticipantPublished(
  async (event: ParticipantPublishedEvent) => {
    const conferenceId = event.conferenceId;
    const participantId = event.participantId;
    const streamId = event.streamId;

    console.log(
      `participant ${participantId} published in conference ${conferenceId} with stream id ${streamId}`
    );

    publishStreamToAllParticipants(conferenceId, participantId, streamId);
  }
);

bandwidthRtc.onParticipantUnsubscribed(
  async (event: ParticipantUnsubscribedEvent) => {
    const conferenceId = event.conferenceId;
    const participantId = event.participantId;
    const streamId = event.streamId;

    console.log(
      `participant ${participantId} unsubscribed from stream ${streamId} in conference ${conferenceId}`
    );
  }
);

const subscribeParticipantToAllStreams = async (
  conferenceId: string,
  participantId: string
) => {
  const conference = conferences.get(conferenceId);
  if (conference) {
    const participant = conference.participants.get(participantId);
    if (participant) {
      participant.status = "connected";

      let promises = [];
      for (const [publisherId, publisher] of conference.participants) {
        if (participantId !== publisherId) {
          for (const streamId of publisher.streams) {
            console.log(
              `subscribing participant ${participantId} to stream ${publisherId}:${streamId}`
            );
            promises.push(
              bandwidthRtc.subscribe(conferenceId, participantId, streamId)
            );
          }
        }
      }

      for (const p of promises) {
        try {
          await p;
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
};

const publishStreamToAllParticipants = async (
  conferenceId: string,
  publisherId: string,
  streamId: string
) => {
  const conference = conferences.get(conferenceId);
  if (conference) {
    const publisher = conference.participants.get(publisherId);
    if (publisher) {
      publisher.streams.push(streamId);

      let promises = [];
      for (const [participantId, participant] of conference.participants) {
        if (
          publisherId !== participantId &&
          participant.status === "connected"
        ) {
          console.log(
            `subscribing participant ${participantId} to stream ${publisherId}:${streamId}`
          );
          promises.push(
            bandwidthRtc.subscribe(conferenceId, participantId, streamId)
          );
        }
      }

      for (const p of promises) {
        try {
          await p;
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
};

app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

app.listen(port, async () => {
  console.log(`Server is listening on port ${port}`);
});
