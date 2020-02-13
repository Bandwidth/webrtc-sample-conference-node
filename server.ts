import express from "express";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import BandwidthRtc, {
  ParticipantJoinedEvent,
  ParticipantLeftEvent,
  ParticipantPublishedEvent,
  ParticipantUnsubscribedEvent
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

interface Conference {
  id: string;
  name?: string;
  participants: Map<string, Participant>;
}

interface Participant {
  id: string;
  status: string;
  name?: string;
  streams: string[];
}

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
  .connect({
    accountId: accountId,
    username: username,
    password: password
  }, options)
  .then(() => {
    console.log("bandwidth rtc websocket connected");
  });

app.use(cors());
app.use(bodyParser.json());

/**
 * Used for load balancer health checks
 */
app.get("/ping", (req, res) => {
  res.send("OK");
});

app.get("/conferences", async (req, res) => {
  try {
    let ret = Array.from(conferences.values()).reduce(
      (ret: any[], conference: Conference) => {
        ret.push({ id: conference.id, name: conference.name });
        return ret;
      },
      []
    );
    console.log("ret", ret);
    res.status(200).send(ret);
  } catch (e) {
    console.log("e", e);
    res.status(400).send(e);
  }
});

app.post("/conferences", async (req, res) => {
  try {
    console.log("body", req.body);
    const name = req.body.name;
    console.log("name", name);
    let conferenceId = await bandwidthRtc.startConference();
    console.log("conferenceId", conferenceId);
    conferences.set(conferenceId, {
      id: conferenceId,
      name: name,
      participants: new Map()
    });
    console.log("conferenceMap", conferences);
    res.status(200).send({ id: conferenceId, name: name });
  } catch (e) {
    res.status(400).send(e);
  }
});

app.delete("/conferences/:conferenceId", async (req, res) => {
  try {
    conferences.delete(req.params.conferenceId);
    await bandwidthRtc.endConference(req.params.conferenceId);
    res.status(204).send();
  } catch (e) {
    res.status(400).send(e);
  }
});

app.get("/conferences/:conferenceId/participants", async (req, res) => {
  try {
    let conference = conferences.get(req.params.conferenceId);
    if (conference) {
      let ret = Array.from(conference.participants.values()).reduce(
        (ret: any[], participant: Participant) => {
          if (participant.status === "connected") {
            ret.push({ id: participant.id, name: participant.name });
          }
          return ret;
        },
        []
      );
      res.status(200).send(ret);
    } else {
      res.status(404).send();
    }
  } catch (e) {
    console.log("e", e);
    res.status(400).send(e);
  }
});

app.post("/conferences/:conferenceId/participants", async (req, res) => {
  try {
    const conferenceId = req.params.conferenceId;
    let conference = conferences.get(conferenceId);
    if (conference) {
      console.log("body", req.body);
      const name = req.body.name;
      const phoneNumber = req.body.phoneNumber;
      console.log("name", name);
      let participantId = await bandwidthRtc.createParticipant(conferenceId);
      conference.participants.set(participantId, {
        id: participantId,
        status: "pending",
        name: name,
        streams: []
      });
      if (phoneNumber) {
        callPhoneNumber(phoneNumber, conferenceId, participantId);
      }
      res.status(200).send({ id: participantId, websocketUrl: websocketDeviceUrl });
    } else {
      res.status(404).send();
    }
  } catch (e) {
    res.status(400).send(e);
  }
});

app.post(
  "conferences/:conferenceId/participants/:participantId/unpublish",
  async (req, res) => {
    try {
      let conference = conferences.get(req.params.conferenceId);
      let participant = conferences.get(req.params.participantId);
      if (!!conference && !!participant) {
        console.log("body", req.body);
        const name = req.body.name;
        console.log("name", name);
        console.log("body", req.body);
        await bandwidthRtc.unpublish(
          req.params.conferenceId,
          req.params.participantId,
          req.params.streamId
        );
        res.status(200).send();
      } else {
        res.status(404).send();
      }
    } catch (e) {
      res.status(400).send(e);
    }
  }
);

app.post(
  "conferences/:conferenceId/participants/:participantId/unsubscribe/:streamId",
  async (req, res) => {
    try {
      let conference = conferences.get(req.params.conferenceId);
      let participant = conferences.get(req.params.participantId);
      let streamId = conferences.get(req.params.streamId);
      if (!!conference && !!participant && !!streamId) {
        console.log("body", req.body);
        const name = req.body.name;
        console.log("name", name);
        console.log("body", req.body);
        await bandwidthRtc.unsubscribe(
          req.params.conferenceId,
          req.params.participantId,
          req.params.streamId
        );
        res.status(200).send();
      } else {
        res.status(404).send();
      }
    } catch (e) {
      res.status(400).send(e);
    }
  }
);

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
      applicationId: voiceAppId
    },
    {
      auth: {
        username: username,
        password: password
      }
    }
  );
  console.log(response.data);
  console.log(`ringing ${phoneNumber}...`);
};

app.post("/callback/:conferenceId/:participantId", async (req, res) => {
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
  res.contentType("application/xml").send(bxml);
  console.log("transferring call");
});

app.post("/callback/incoming", async (req, res) => {
  console.log(`received new incoming call from ${req.body.from}`);
  const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
  <Response>
      <Gather maxDigits="7" gatherUrl="${voiceCallbackUrl}/joinConference">
        <SpeakSentence voice="julie">Welcome to Bandwidth WebRTC Conferencing. Please enter your 7 digit conference ID.</SpeakSentence>
      </Gather>
  </Response>`;
  res.contentType("application/xml").send(bxml);
  console.log("transferring call");
});

app.post("/callback/joinConference", async (req, res) => {
  const conferenceId = req.body.digits;
  console.log(
    `${req.body.from} is attempting to join conference ${conferenceId}`
  );
  let conference = conferences.get(conferenceId);
  if (conference) {
    let participantId = await bandwidthRtc.createParticipant(conferenceId);
    conference.participants.set(participantId, {
      id: participantId,
      status: "pending",
      name: req.body.from,
      streams: []
    });

    const bxml = `<?xml version="1.0" encoding="UTF-8" ?>
    <Response>
        <SpeakSentence voice="julie">Thank you. Connecting you to your conference now.</SpeakSentence>
        ${bandwidthRtc.generateTransferBxml(conferenceId, participantId)}
    </Response>`;
    res.contentType("application/xml").send(bxml);
    console.log("transferring call");
  } else {
    res.status(400).send();
  }
});

const conferences: Map<string, Conference> = new Map();

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
    // Remove the participant from our local state
    conference.participants.delete(participantId);
    // Remove the participant from the conference
    await bandwidthRtc.removeParticipant(conferenceId, participantId);
    // If everyone has left the conference, let's shut it down
    if (conference.participants.size === 0) {
      await bandwidthRtc.endConference(conferenceId);
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

    await publishStreamToAllParticipants(conferenceId, participantId, streamId);
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
      for (const [publisherId, publisher] of conference.participants) {
        if (participantId !== publisherId) {
          for (const streamId of publisher.streams) {
            console.log(
              `subscribing participant ${participantId} to stream ${publisherId}:${streamId}`
            );
            try {
              await bandwidthRtc.subscribe(
                conferenceId,
                participantId,
                streamId
              );
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    }
  }
};

const publishStreamToAllParticipants = (
  conferenceId: string,
  publisherId: string,
  streamId: string
) => {
  const conference = conferences.get(conferenceId);
  if (conference) {
    const publisher = conference.participants.get(publisherId);
    if (publisher) {
      publisher.streams.push(streamId);
      for (const [participantId, participant] of conference.participants) {
        if (
          publisherId !== participantId &&
          participant.status === "connected"
        ) {
          console.log(
            `subscribing participant ${participantId} to stream ${publisherId}:${streamId}`
          );
          bandwidthRtc.subscribe(conferenceId, participantId, streamId);
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
