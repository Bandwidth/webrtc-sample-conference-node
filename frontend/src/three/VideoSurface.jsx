import React from 'react';
import { BoxGeometry, MeshFaceMaterial, VideoTexture, LinearFilter, RGBFormat, MeshBasicMaterial } from 'three';



const VideoSurface = (props) => {

    const video = document.createElement('video');
    video.setAttribute("src", "/vid.mp4");
    video.autoplay = true;
  
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
  
    return (
        <mesh
            {...props}
            scale={[1,1,1]}
            geometry={new BoxGeometry(1.6, 0.9, 0.2)}
            material={faceMaterial}
            />
    )
}

export default VideoSurface