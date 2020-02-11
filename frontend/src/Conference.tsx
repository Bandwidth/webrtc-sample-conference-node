import React, { useEffect, useState } from "react";
import { Redirect, useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import DynamicGrid from "./DynamicGrid";
import Welcome from "./Welcome";
import BandwidthRtc, {
  SubscriptionEvent,
  RtcStream,
  MediaType
} from "@bandwidth/webrtc-browser-sdk";
import CallControl from "./CallControl";
import { Avatar } from "@material-ui/core";
import { Phone } from "@material-ui/icons";
import { randomBrandColorFromString } from "./Utils";

const bandwidthRtc = new BandwidthRtc();
const backendUrl = '';
const phoneNumber = process.env.REACT_APP_PHONE_NUMBER;

const useStyles = makeStyles(theme => ({
  conference: {
    color: "#fff"
  },
  conferenceNoCursor: {
    cursor: "none",
    color: "#fff"
  },
  video: {
    left: "50%",
    minHeight: "100%",
    minWidth: "100%",
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)"
  },
  localVideo: {
    right: "20px",
    position: "absolute",
    top: "20px",
    transform: "scaleX(-1)",
    borderRadius: "10px",
    zIndex: 10,
    border: "1px solid rgba(255, 255, 255, 0.33)",
    maxWidth: "200px",
    boxShadow: "0px 4px 20px rgba(0,0,0,0.5)",
    opacity: 1,
    transition: "opacity .5s ease-in-out",
    "&:hover": {
      opacity: 0,
      transition: "opacity .1s ease-in-out"
    }
  },
  hiddenVideo: {
    display: "none"
  },
  phoneWrapper: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  phoneIcon: {
    fontSize: "10vw",
    height: "auto",
    width: "auto",
    padding: "2vw"
  },
  iconFont: {
    fontSize: "10vw"
  },
  callControl: {
    opacity: 1,
    transition: "opacity .25s ease-in-out"
  },
  callControlHidden: {
    opacity: 0,
    transition: "opacity .5s ease-in-out"
  }
}));

let immersiveModeTimeout: NodeJS.Timeout | null = null;

const Conference: React.FC = props => {
  const classes = useStyles();
  let { conferenceId } = useParams();
  const [remoteStreams, setRemoteStreams] = useState<{
    [key: string]: RtcStream;
  }>({});
  const [localStream, setLocalStream] = useState<RtcStream>();
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string>();

  useEffect(() => {
    fetch(`${backendUrl}/conferences/${conferenceId}/participants`, {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: {
        "Content-Type": "application/json"
      }
    }).then(async response => {
      if (conferenceId) {
        const responseBody = await response.json();
        const participantId = responseBody.id;
        let options: any = {};
        if (responseBody.websocketUrl) {
          options.websocketUrl = responseBody.websocketUrl;
        }
        await bandwidthRtc.connect({
          conferenceId: conferenceId,
          participantId: participantId
        }, options);
        const publishResponse = await bandwidthRtc.publish();
        setLocalStream(publishResponse);
      }
    });
  }, [conferenceId]);

  useEffect(() => {
    bandwidthRtc.onSubscribe((stream: RtcStream) => {
      setRemoteStreams({
        ...remoteStreams,
        [stream.streamId]: stream
      });
    });

    bandwidthRtc.onUnsubscribed((event: SubscriptionEvent) => {
      const {
        [event.streamId]: oldStream,
        ...remainingStreams
      } = remoteStreams;
      setRemoteStreams(remainingStreams);
    });
  }, [remoteStreams]);

  useEffect(() => {
    if (immersiveModeTimeout) {
      clearTimeout(immersiveModeTimeout);
    }
    immersiveModeTimeout = setTimeout(() => {
      setImmersiveMode(true);
    }, 3000);
    return () => {
      if (immersiveModeTimeout) {
        clearTimeout(immersiveModeTimeout);
      }
    };
  }, [immersiveMode]);

  return (
    <div
      className={
        immersiveMode ? classes.conferenceNoCursor : classes.conference
      }
      onMouseMove={() => setImmersiveMode(false)}
    >
      <video
        id="localVideoPreview"
        playsInline
        autoPlay
        muted
        className={classes.localVideo}
        ref={localVideoElement => {
          if (
            localVideoElement &&
            localStream &&
            localVideoElement.srcObject !== localStream.mediaStream
          ) {
            localVideoElement.srcObject = localStream.mediaStream;
          }
        }}
      ></video>

      <DynamicGrid>
        {Object.keys(remoteStreams).length > 0 ? (
          Object.keys(remoteStreams).map((streamId: string) => {
            const remoteStream = remoteStreams[streamId];
            if (remoteStream.mediaType === MediaType.AUDIO) {
              return (
                <div className={classes.phoneWrapper}>
                  <Avatar
                    className={classes.phoneIcon}
                    style={{
                      backgroundColor: randomBrandColorFromString(
                        remoteStream.streamId
                      )
                    }}
                  >
                    <Phone className={classes.iconFont} />
                  </Avatar>
                  <video
                    playsInline
                    autoPlay
                    className={classes.hiddenVideo}
                    key={streamId}
                    ref={remoteVideoElement => {
                      if (
                        remoteVideoElement &&
                        remoteStream &&
                        remoteVideoElement.srcObject !==
                          remoteStream.mediaStream
                      ) {
                        remoteVideoElement.srcObject = remoteStream.mediaStream;
                      }
                    }}
                  ></video>
                </div>
              );
            } else {
              return (
                <video
                  playsInline
                  autoPlay
                  className={classes.video}
                  key={streamId}
                  ref={remoteVideoElement => {
                    if (
                      remoteVideoElement &&
                      remoteStream &&
                      remoteVideoElement.srcObject !== remoteStream.mediaStream
                    ) {
                      remoteVideoElement.srcObject = remoteStream.mediaStream;
                    }
                  }}
                ></video>
              );
            }
          })
        ) : (
          <Welcome
            conferenceId={conferenceId}
            phoneNumber={phoneNumber}
          ></Welcome>
        )}
      </DynamicGrid>

      <CallControl
        className={
          immersiveMode ? classes.callControlHidden : classes.callControl
        }
        onMicEnabled={bandwidthRtc.setMicEnabled}
        onCameraEnabled={bandwidthRtc.setCameraEnabled}
        onHangup={() => {
          bandwidthRtc.disconnect();
          setRedirectTo("/");
        }}
      >
        >
      </CallControl>
      {redirectTo != null ? <Redirect to={redirectTo}></Redirect> : undefined}
    </div>
  );
};

export default Conference;
