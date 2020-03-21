
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';
import { BufferGeometry, Vector3, Line, Matrix4, Raycaster, Group } from 'three';

class ControllerManager {
    constructor() {
        this.controllerModelFactory = new XRControllerModelFactory();
        this.tempMatrix = new Matrix4();
        this.raycaster = null;
        this.interactable = new Group();
    }

    setForceUpdate(forceUpdate) {
        this.forceUpdate = forceUpdate
    }

    addInteractable(obj) {
        this.interactable.add(obj);
        console.log(this.interactable);
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

        /*
        controller1.addEventListener( 'connected', function ( event ) {
            console.log('controller');
        });
        */

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