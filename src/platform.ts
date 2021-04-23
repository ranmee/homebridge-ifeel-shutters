import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IFeelShutter } from './platformAccessory';
import { IFeelAPI } from './iFeelAPI';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class IFeelPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  private readonly hubIP: string;
  private readonly email: string;
  private readonly password: string;
  private readonly authenticationInterval: number = 1000 * 60 * 10;
  
  public readonly pollingInterval: number;
  public readonly maxPollingTime: number;
  
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly iFeelApi: IFeelAPI;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // Get the user's email and password so we can authenticate later.
    this.hubIP = config['hubIP'];
    this.email = config['email'];
    this.password = config['password'];
    // Get the polling interval from the configuration or set a default value of 2 seconds.
    this.pollingInterval = config['pollingInterval'] ? parseInt(config['pollingInterval']) * 1000 : 2500;
    // Set a maximum polling time for a shutter (so we won't poll it forever).
    this.maxPollingTime = 1000 * 60;
    this.iFeelApi = new IFeelAPI(this.hubIP, this.email, this.password, this.log);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // todo: start authentication loop.
      this.iFeelApi.authenticate().then(() => {
        // run the method to discover / register your devices as accessories
        this.discoverDevices();
      });

      // Re-authenticate every <authenticationInterval> to keep us logged in.
      setInterval(() => {
        this.iFeelApi.authenticate();
      }, this.authenticationInterval);
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    this.iFeelApi.getShuttersData().then(data => {
      const devices = data.filter(unitData => unitData['type'] === 'shutter').map(unitData => {
        return {id: unitData.id, displayName: unitData.name};
      });
      
      // loop over the discovered devices and register each one if it has not already been registered
      for (const device of devices) {

        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address
        const uuid = this.api.hap.uuid.generate(device.id.toString());

        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          // the accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

          // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
          // existingAccessory.context.device = device;
          // this.api.updatePlatformAccessories([existingAccessory]);

          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          new IFeelShutter(this, existingAccessory, device.id);

        } else {
          // the accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', device.displayName);

          // create a new accessory
          const accessory = new this.api.platformAccessory(device.displayName, uuid);

          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.device = device;

          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          new IFeelShutter(this, accessory, device.id);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    });
  }
}
