
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory';

class ControllerManager {
    constructor() {
        this.controllerModelFactory = new XRControllerModelFactory();
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
    }

}

export default ControllerManager