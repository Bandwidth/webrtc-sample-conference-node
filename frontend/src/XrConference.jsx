import React, { useState, useEffect } from 'react'
import { createStyles, makeStyles } from "@material-ui/core/styles";
import { Canvas } from 'react-three-fiber'
import { ACESFilmicToneMapping, sRGBEncoding } from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import ControllerManager from './three/ControllerManager';
import { BoxGeometry, MeshFaceMaterial, VideoTexture, LinearFilter, RGBFormat, MeshBasicMaterial, Mesh } from 'three';

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

const useForceUpdate = () => {
  const [value, setValue] = useState(0); // integer state
  return () => setValue(value => ++value); // update the state to force render
}

const controllers = new ControllerManager();

const XrConference = () => {
  console.log("RENDERING");
  const styles = useStyles();
  const forceUpdate = useForceUpdate();
  controllers.setForceUpdate(forceUpdate);

  useEffect(() => {

    const video = document.createElement('video');
    video.setAttribute("src", "/vid.mp4");
    video.autoplay = true;
    video.loop = true;
  
    const texture = new VideoTexture(video);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.format = RGBFormat;
  
    var materialArray = [];
    materialArray.push(new MeshBasicMaterial({color: 0x0051ba}));
    materialArray.push(new MeshBasicMaterial({color: 0x0051ba}));
    materialArray.push(new MeshBasicMaterial({color: 0x0051ba}));
    materialArray.push(new MeshBasicMaterial({color: 0x0051ba}));
    materialArray.push(new MeshBasicMaterial({map: texture}));
    materialArray.push(new MeshBasicMaterial({color: 0xff51ba}));
    var faceMaterial = new MeshFaceMaterial(materialArray);
  
    var newMesh = new Mesh(new BoxGeometry(1.6, 0.9, 0.2),faceMaterial);
  
    controllers.addInteractable(newMesh);
  },[]);

  const [controller1, updateController1] = useState(null);
  const [controller2, updateController2] = useState(null);

  const canvasCreated = ({gl}) => {
    document.body.appendChild(VRButton.createButton(gl,{referenceSpaceType: "bounded-floor"}));
    controllers.attachControllers(gl);
    updateController1(controllers.controller1);
    updateController2(controllers.controller2);
    gl.setClearColor('white');
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputEncoding = sRGBEncoding;
  }


  return (
    <div className={styles.canvasContainer}>
      <Canvas
      gl={{alpha: false}}
      className={styles.canvas}
      onCreated={canvasCreated}
      vr
      >
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <primitive object={controllers.interactable} position={[0,0,0]} />
        { controller1 ? <primitive object={controller1.grip} position={[0,0,0]} /> : null }
        { controller2 ? <primitive object={controller2.grip} position={[0,0,0]} /> : null }
      </Canvas>
    </div>
    
  )
}

export default XrConference;