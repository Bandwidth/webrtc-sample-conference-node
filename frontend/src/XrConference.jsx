import React, { useState } from 'react'
import { createStyles, makeStyles } from "@material-ui/core/styles";
import { Canvas } from 'react-three-fiber'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import VideoSurface from './three/VideoSurface';
import ControllerManager from './three/ControllerManager';

const useStyles = makeStyles(theme =>
  createStyles({
      canvasContainer: {
        position: "absolute",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh"
      },
      canvas: {
        width: "100vw",
        height: "100vh"
      }
  })
);

const XrConference = () => {
  const styles = useStyles();
  const controllers = new ControllerManager();

  const [controller1, updateController1] = useState(null);
  const [controller2, updateController2] = useState(null);

  const canvasCreated = ({gl}) => {
    document.body.appendChild(VRButton.createButton(gl,{referenceSpaceType: "bounded-floor"}));
    controllers.attachControllers(gl);
    updateController1(controllers.controller1);
    updateController2(controllers.controller2);
  }

  console.log(controller1,controller2)

  return (
    <div className={styles.canvasContainer}>
      <Canvas
      className={styles.canvas}
      onCreated={canvasCreated}
      vr
      >
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <VideoSurface position={[10, 0, 0]} />
        { controller1 ? <primitive object={controller1.grip} position={[0,0,0]} /> : null }
        { controller2 ? <primitive object={controller2.grip} position={[0,0,0]} /> : null }
      </Canvas>
    </div>
    
  )
}

export default XrConference;