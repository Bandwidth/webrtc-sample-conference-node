import React, { useState } from "react";
import { Fab, Box } from "@material-ui/core";
import {
  CallEnd,
  Mic,
  MicOff,
  Videocam,
  VideocamOff
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import red from "@material-ui/core/colors/red";

interface CallControlProps {
  className?: string;
  onMicEnabled?: { (muted: boolean): void };
  onCameraEnabled?: { (muted: boolean): void };
  onHangup?: { (): void };
}

const useStyles = makeStyles(theme => ({
  callControl: {
    backgroundColor: "rgba(255, 255, 255, 0.50)",
    backdropFilter: "blur(5px)",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "auto",
    "& button": {
      margin: "10px"
    },
    "& button:hover": {
      color: "white",
      backgroundColor: red["A700"]
    },
    display: "flex",
    justifyContent: "center"
  },
  pressed: {
    color: "white",
    backgroundColor: red["A700"]
  }
}));

const CallControl: React.FC<CallControlProps> = props => {
  const classes = useStyles();

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  return (
    <div className={props.className}>
      <Box className={classes.callControl}>
        <Fab
          onClick={() => {
            setMicEnabled(!micEnabled);
            if (props.onMicEnabled) {
              props.onMicEnabled(!micEnabled);
            }
          }}
          className={micEnabled ? undefined : classes.pressed}
        >
          {micEnabled ? <Mic /> : <MicOff />}
        </Fab>
        <Fab
          onClick={() => {
            if (props.onHangup) {
              props.onHangup();
            }
          }}
        >
          <CallEnd />
        </Fab>
        <Fab
          onClick={() => {
            setCameraEnabled(!cameraEnabled);
            if (props.onCameraEnabled) {
              props.onCameraEnabled(!cameraEnabled);
            }
          }}
          className={cameraEnabled ? undefined : classes.pressed}
        >
          {cameraEnabled ? <Videocam /> : <VideocamOff />}
        </Fab>
      </Box>
    </div>
  );
};

export default CallControl;
