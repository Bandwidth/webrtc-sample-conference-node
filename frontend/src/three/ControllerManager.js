
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';
import { BufferGeometry, Vector3, Line, Matrix4, Raycaster, Group, BoxGeometry, MeshFaceMaterial, VideoTexture, LinearFilter, RGBFormat, MeshBasicMaterial, Mesh, MeshPhongMaterial } from 'three';
import { MediaType } from "@bandwidth/webrtc-browser-sdk";

class ControllerManager {
    constructor() {
        this.controllerModelFactory = new XRControllerModelFactory();
        this.tempMatrix = new Matrix4();
        this.raycaster = null;
        this.interactable = new Group();
        this.streams = {};
    }

    addInteractable(obj) {
        this.interactable.add(obj);
        console.log(this.interactable);
    }


    removeInteractable(obj) {
        this.interactable.remove(obj);
    }

    addVideoObject(id) {

        let stream = this.streams[id];

        let aspectRatio = stream.mediaStream.getVideoTracks()[0].getSettings().aspectRatio;
        const video = document.createElement('video');
        video.autoplay = true;
        video.loop = true;
        video.srcObject = stream.mediaStream
      
        const texture = new VideoTexture(video);
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.format = RGBFormat;
      
        var materialArray = [];
        materialArray.push(new MeshPhongMaterial({color: 0x00bef0}));
        materialArray.push(new MeshPhongMaterial({color: 0x00bef0}));
        materialArray.push(new MeshPhongMaterial({color: 0x00bef0}));
        materialArray.push(new MeshPhongMaterial({color: 0x00bef0}));
        materialArray.push(new MeshBasicMaterial({map: texture}));
        materialArray.push(new MeshPhongMaterial({color: 0x00bef0}));
        var faceMaterial = new MeshFaceMaterial(materialArray);
      
        var newMesh = new Mesh(new BoxGeometry(aspectRatio, 1, 0.05),faceMaterial);
        newMesh.position.set(0,1,-1.5);
      
        this.addInteractable(newMesh);
        this.streams[stream.streamId].threeObject = newMesh
    }

    waitForMetaData(id) {
        if (this.streams[id] && this.streams[id].mediaStream.getVideoTracks()[0].getSettings().aspectRatio) {
            this.addVideoObject(id);
        } else {
            setTimeout(() => {
                this.waitForMetaData(id);
            },200)
        }
    }

    addStream(stream) {
        if (!this.streams[stream.streamId] && stream.mediaType !== MediaType.AUDIO) {
            this.streams[stream.streamId] = stream;
            this.waitForMetaData(stream.streamId);
        }
    }

    removeStream(id) {
        console.log('removing',id);
        console.log(this.streams,this.streams[id]);
        let stream = this.streams[id]
        this.removeInteractable(stream.threeObject)
        delete this.streams[id];
    }

    attachControllers(renderer) {
        this.renderer = renderer;
        this.controller1 = {
            controller: renderer.xr.getController(0),
            grip: renderer.xr.getControllerGrip(0)
        };
        this.controller2 = {
            controller: renderer.xr.getController(1),
            grip: renderer.xr.getControllerGrip(1)
        };
        // create and attach the model groups
        this.controller1.grip.add(this.controllerModelFactory.createControllerModel(this.controller1.grip))
        this.controller2.grip.add(this.controllerModelFactory.createControllerModel(this.controller2.grip))

       var geometry = new BufferGeometry().setFromPoints( [ new Vector3( 0, 0, 0 ), new Vector3( 0, 0, - 1 ) ] );

       var line = new Line( geometry );
       line.name = 'line';
       line.scale.z = 5;

       this.controller1.grip.add( line.clone() );
       this.controller2.grip.add( line.clone() );

        // add select listeners
        this.controller1.grip.addEventListener( 'selectstart', this.onSelectStart );
        this.controller1.grip.addEventListener( 'selectend', this.onSelectEnd );

        
        this.controller2.grip.addEventListener( 'selectstart', this.onSelectStart );
        this.controller2.grip.addEventListener( 'selectend', this.onSelectEnd );
        
        this.raycaster = new Raycaster();
    }

    onSelectStart = (event) => {
        var controller = event.target;
        var intersections = this.getIntersections( controller );

        if ( intersections.length > 0 ) {

            var intersection = intersections[ 0 ];

            this.tempMatrix.getInverse( controller.matrixWorld );

            var object = intersection.object;
            object.matrix.premultiply( this.tempMatrix );
            object.matrix.decompose( object.position, object.quaternion, object.scale );
            controller.add( object );

            controller.userData.selected = object;
        }
    }

    onSelectEnd = (event) => {
        var controller = event.target;

        if ( controller.userData.selected !== undefined ) {
            console.log('removing from controller!');
            var object = controller.userData.selected;
            object.matrix.premultiply( controller.matrixWorld );
            object.matrix.decompose( object.position, object.quaternion, object.scale );

            this.addInteractable(object);

            controller.userData.selected = undefined;

        }
    }


    getIntersections = (controller) => {

        this.tempMatrix.identity().extractRotation( controller.matrixWorld );

        this.raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
        this.raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( this.tempMatrix );

        return this.raycaster.intersectObjects(this.interactable.children);

    }
}

export default ControllerManager