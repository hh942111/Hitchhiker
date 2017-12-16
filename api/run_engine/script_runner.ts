import * as request from 'request';
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectService } from '../services/project_service';
import { Setting } from '../utils/setting';
import { Sandbox } from './sandbox';
import * as freeVM from 'vm';
import { ResObject } from '../common/res_object';
import { Log } from '../utils/log';
import { Record, RecordEx } from '../models/record';
const { NodeVM: safeVM } = require('vm2');

export class ScriptRunner {

    static async prerequest(record: RecordEx): Promise<ResObject> {
        const { pid, vid, uid, envId, envName, prescript } = record;
        let hitchhiker: Sandbox, res: ResObject;
        try {
            hitchhiker = new Sandbox(pid, uid || vid, envId, envName, record);
        } catch (ex) {
            res = { success: false, message: ex };
        }

        res = await ScriptRunner.run({ hitchhiker, hh: hitchhiker }, prescript);
        res.result = hitchhiker.request;
        return res;
    }

    static async test(record: RecordEx, res: request.RequestResponse): Promise<{ tests: _.Dictionary<boolean>, export: {} }> {
        const { pid, vid, uid, envId, envName, test } = record;
        let hitchhiker, tests;
        try {
            hitchhiker = new Sandbox(pid, uid || vid, envId, envName);
        } catch (ex) {
            tests = {};
            tests[ex] = false;
        }
        if (!hitchhiker) {
            return { tests, export: undefined };
        }
        tests = hitchhiker.tests;
        const $variables$: any = hitchhiker.variables;
        const $export$ = hitchhiker.export;

        const sandbox = { hitchhiker, hh: hitchhiker, $variables$, $export$, tests, ...ScriptRunner.getInitResObj(res) };

        const rst = await ScriptRunner.run(sandbox, test);
        if (!rst.success) {
            tests[rst.message] = false;
        }
        _.keys(tests).forEach(k => tests[k] = !!tests[k]);
        return { tests, export: hitchhiker.exportObj.content };
    }

    private static run(sandbox: any, code: string): Promise<ResObject> {
        let success = true, message = '';
        try {
            code = `module.exports = function(callback) { 
                    void async function() { 
                        try{
                            ${code || ''};
                            callback();
                        }catch(err){
                            callback(err);
                        }
                    }(); 
                }`;
            const vm = new safeVM({ timeout: Setting.instance.scriptTimeout, sandbox });
            const runWithCallback = vm.run(code);
            return new Promise<ResObject>((resolve, reject) => {
                runWithCallback((err) => {
                    if (err) {
                        Log.error(err);
                    }
                    resolve({ success: !err, message: err });
                });
            });

            // freeVM.runInContext(code, freeVM.createContext(sandbox), { timeout: 50000 });
        } catch (err) {
            success = false;
            message = err;
            Log.error(err);
        }
        return Promise.resolve({ success, message });
    }

    private static getInitResObj(res: request.RequestResponse) {
        let responseObj = {};
        try {
            responseObj = JSON.parse(res.body); // TODO: more response type, xml, protobuf, zip, chunk...
        } catch (e) {
            responseObj = e;
        }
        return {
            responseBody: res.body,
            responseCode: { code: res.statusCode, name: res.statusMessage },
            responseObj,
            responseHeaders: res.headers,
            responseTime: res.timingPhases.total >> 0
        };
    }
}