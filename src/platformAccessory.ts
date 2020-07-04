import { Service, PlatformAccessory } from 'homebridge';

import { IFeelPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class IFeelShutter {
  private service: Service;

  // Shutter state object.
  private state = {
    targetPosition: 0,
    currentPosition: 0,
  }

  constructor(
    private readonly platform: IFeelPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly shutterId: number,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the WindowCovering service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.WindowCovering) || this.accessory.addService(this.platform.Service.WindowCovering);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.displayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // create handlers for required characteristics.
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .on('get', this.handleCurrentPositionGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .on('get', this.handleTargetPositionGet.bind(this))
      .on('set', this.handleTargetPositionSet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .on('get', this.handlePositionStateGet.bind(this));
  }

  /**
   * Handle requests to get the current value of the "Current Position" characteristic
   */
  handleCurrentPositionGet(callback) {
    this.platform.log.debug('Triggered GET CurrentPosition');

    this.platform.iFeelApi.getShutterPosition(this.shutterId).then((position: number) => {
      this.state.currentPosition = position;
      callback(null, position);
    });
  }

  /**
   * Handle requests to get the current value of the "Target Position" characteristic
   */
  handleTargetPositionGet(callback) {
    this.platform.log.debug('Triggered GET TargetPosition');
    callback(null, this.state.targetPosition);
  }

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  handleTargetPositionSet(value, callback) {
    this.platform.log.debug('Triggered SET TargetPosition:' + value);

    // Save the state locally so we can later return it.
    this.state.targetPosition = value;
    // Post the new requested state to the shutter api.
    this.platform.iFeelApi.postShutterAction(this.shutterId, value);

    callback(null);
  }

  /**
   * Handle requests to get the current value of the "Position State" characteristic
   */
  handlePositionStateGet(callback) {
    this.platform.log.debug('Triggered GET PositionState');

    this.platform.iFeelApi.getShutterPosition(this.shutterId).then((position: number) => {
      this.state.currentPosition = position;
      
      let currentValue;
      if (this.state.currentPosition > this.state.targetPosition) {
        // The shutter is: Decreasing.
        currentValue = 0;
      } else if (this.state.currentPosition < this.state.targetPosition) {
        // The shutter is: Increasing.
        currentValue = 1;
      } else {
        // The shutter is: Stopped. Both target and current possitions are the same.
        currentValue = 2;
      }

      callback(null, currentValue);
    });
  }
}
