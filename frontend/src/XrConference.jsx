import React, { useState, useEffect, Suspense } from 'react'
import { useParams } from "react-router-dom";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import { Canvas, useThree, useLoader } from 'react-three-fiber'
import { ACESFilmicToneMapping, sRGBEncoding} from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import ControllerManager from './three/ControllerManager';
import BandwidthRtc from "@bandwidth/webrtc-browser-sdk";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import Box from './three/Box';
import Camera from './three/Camera';
import Swarm from './three/Swarm';

const backendUrl = 'https://meet.webrtc.bandwidth.com';
const bandwidthRtc = new BandwidthRtc();

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



const controllers = new ControllerManager();

const XrConference = () => {
  const styles = useStyles();

  const [controller1, updateController1] = useState(null);
  const [controller2, updateController2] = useState(null);

  let { conferenceId } = useParams();
  const [remoteStreams, setRemoteStreams] = useState({});

  const three = useThree();

  const Asset = ({ url, ...props }) => {
    const gltf = useLoader(GLTFLoader, url)
    return <primitive {...props} object={gltf.scene} dispose={null} />
  }

  useEffect(() => {
    // get current participants via backend when conference ID set/changes
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
        let options = {};
        if (responseBody.websocketUrl) {
          options.websocketUrl = responseBody.websocketUrl;
        }
        await bandwidthRtc.connect({
          conferenceId: conferenceId,
          participantId: participantId
        }, options);
        
        await bandwidthRtc.publish();
      }
    });
    return () => {
        bandwidthRtc.disconnect();
    }
  }, [conferenceId]);

  useEffect(() => {
    bandwidthRtc.onSubscribe((stream) => {
      controllers.addStream(stream);
      setRemoteStreams({
        ...remoteStreams,
        [stream.streamId]: stream
      });
    });

    bandwidthRtc.onUnsubscribed((event) => {
      const {
        [event.streamId]: oldStream,
        ...remainingStreams
      } = remoteStreams;
      controllers.removeStream(event.streamId);
      setRemoteStreams(remainingStreams);
    });
  }, [remoteStreams]);


  // setup the controller manager once the three canvas is ready
  const canvasCreated = ({gl}) => {
    document.body.appendChild(VRButton.createButton(gl,{referenceSpaceType: "bounded-floor"}));
    controllers.attachControllers(gl);
    updateController1(controllers.controller1);
    updateController2(controllers.controller2);
    gl.setClearColor('white');
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputEncoding = sRGBEncoding;
    gl.shadowMapEnabled = true;
  }


  return (
    <div className={styles.canvasContainer}>
      <Canvas
      gl={{alpha: false}}
      className={styles.canvas}
      onCreated={canvasCreated}
      vr
      >
        <Camera 
          position={[0,2,6]}
          lookAt={[0,0,0]}
          />
        <ambientLight intensity={.7} />
        <pointLight position={[-100, 100, 100]} intensity={1.1} color={0x00bef0} />

        <mesh
          visible
          position={[0,0,0]}
          rotation-x={- Math.PI / 2}
          >
          <planeBufferGeometry
            attach="geometry"
            args={[4,4]}
            />
          <meshPhongMaterial attach="material" color="white" />
        </mesh>
        <Suspense fallback={null}>
          <Asset url="/bw.glb" position={[-.04,1,1.6]} rotation={[0, Math.PI / 4 * 3, 0]} scale={[.06,.06,.06]} />
        </Suspense>
        <Box width={0.5} height={.9} depth={0.5} color={0x151516} position={[0,0.5,1.6]} />
        <Swarm count={30} color={0x00bef0}/>
        <Swarm count={30} color={0x00fbb9}/>
        <Swarm count={30} color={0x651f45}/>
        <Swarm count={30} color={0xff673c}/>
        <primitive object={controllers.interactable} position={[0,0,0]} />
        { controller1 ? <primitive object={controller1.grip} position={[0,0,0]} /> : null }
        { controller2 ? <primitive object={controller2.grip} position={[0,0,0]} /> : null }
      </Canvas>
    </div>
    
    
  )
}

export default XrConference;