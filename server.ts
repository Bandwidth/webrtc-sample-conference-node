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

const port = process.env.PORT || 3000;
const httpServerUrl = <string>process.env.WEBRTC_HTTP_SERVER_URL;
const websocketDeviceUrl = <string>process.env.WEBRTC_DEVICE_URL;

const app = express();

app.use(cors());
app.use(bodyParser.json());

/**
 * Used for load balancer health checks
 */
app.get("/ping", (req, res) => {
  res.send("OK");
});

const slugsToIds: Map<string, string> = new Map(); // Conference slug to conference id

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

  let conferenceId = response.data.id;

  slugsToIds.set(slug, conferenceId);
  return conferenceId;
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

    res.status(200).send({
      websocketUrl: websocketDeviceUrl,
      conferenceId: conferenceId,
      participantId: participant.id,
      deviceToken: token,
    });
  } catch (e) {
    console.log("exception", e);
    res.status(400).send(e);
  }
});

app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

app.listen(port, async () => {
  console.log(`Server is listening on port ${port}`);
});
