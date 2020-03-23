import React, { useEffect } from 'react';
import { BoxGeometry, MeshFaceMaterial, VideoTexture, LinearFilter, RGBFormat, MeshBasicMaterial, Mesh } from 'three';



const VideoSurface = ({add, remove, ...rest}) => {



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

    useEffect(() => {
        add(newMesh);
        return () => {
            remove(newMesh);
        }
    },[])
  
    return (
        <primitive
            {...rest}
            scale={[1,1,1]}
            object={newMesh}
            />
    )
}

export default VideoSurface