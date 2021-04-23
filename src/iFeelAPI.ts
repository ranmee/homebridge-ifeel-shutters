import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { Logger } from 'homebridge';

/**
 * A singleton i-feel shutters API class.
 */
export class IFeelAPI {
  private readonly api: AxiosInstance;
  private readonly logger: Logger;
  private readonly cookieJar;

  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private sessionCookie: string;
  
  constructor(hubIP: string, email: string, password: string, logger: Logger) {
    this.baseUrl = 'http://' + hubIP + '/';
    this.email = email;
    this.password = password;
    this.sessionCookie = '';

    this.logger = logger;

    axiosCookieJarSupport(axios);
    this.cookieJar = new CookieJar();
    this.api = axios.create({
      baseURL: this.baseUrl,
      withCredentials: true,
    });
  }

  private getRequestConfig(params: any | null = null): AxiosRequestConfig {
    const config = {
      withCredentials: true,
      jar: this.cookieJar,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (params) {
      config['params'] = params;
    }

    return config;
  }

  public async authenticate() {
    const params = {
      user: this.email,
      psw: this.password,
    };

    this.logger.info('Sending authentication request to i-feel hub.');
    const response = await this.api.get('auth/login', this.getRequestConfig(params));
    
    // The cookie will identify us for the next ~30 minutes.
    this.logger.info('Successfully authenticated with i-feel hub.');
    this.sessionCookie = response.headers['set-cookie'];
  }

  public async postShutterAction(id: number, value: number) {
    const data = {
      id: id,
      value: value,
    };

    this.logger.info(`Posting unit action to i-feel shutter. id ${id}, value: ${value}`);
    const response = await this.api.post('units/action', data, this.getRequestConfig());
    this.logger.info(`Got unit action response of ${response.status}`);
  }

  public async getShutterPosition(id: number) {
    const params = {
      id: id,
    };

    this.logger.info(`Getting unit data for i-feel shutter. id ${id}`);
    const response = await this.api.get('units/getUnitByID', this.getRequestConfig(params));
    this.logger.info(`Got unit data response of ${response.status}`);

    return response.data['currStatus'];
  }

  public async getShuttersData() {
    this.logger.info('Getting ALL units data from i-feel hub.');
    const response = await this.api.get('units/listUnits', this.getRequestConfig());
    this.logger.info(`Got ALL units data response of ${response.status}`);

    return response.data;
  }
}
