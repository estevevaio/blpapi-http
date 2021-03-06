/// <reference path='../../typings/tsd.d.ts' />

import Promise = require('bluebird');
import bunyan = require('bunyan');
import restify = require('restify');
import blpapi = require('../blpapi-wrapper');
import conf = require('../config');
import interfaces = require('../interface');

// CONSTANTS
var DEFAULT_ID = '__default__';
var DEFAULT_SESSION_OPTIONS = conf.get('sessionOptions');

// GLOBALS
var SESSION_STORE: {[index: string]: Promise<blpapi.Session>} = {};
var LOGGER: bunyan.Logger = bunyan.createLogger(conf.get('loggerOptions'));

// FUNCTIONS
function createSession(sessionId: string): Promise<blpapi.Session>
{
    if (!(sessionId in SESSION_STORE)) {
        var s = new blpapi.Session(DEFAULT_SESSION_OPTIONS);
        var p = s.start()
            .then((): blpapi.Session => {
                LOGGER.info('blpSession created and connected.');
                s.once('SessionTerminated', (): void => {
                    LOGGER.info('blpSession termintated.');
                    delete SESSION_STORE[sessionId];
                });
                return s;
            })
            .catch((err: Error): any => {  // Use any to make ts happy
                delete SESSION_STORE[sessionId];
                LOGGER.error(err, 'blpSession connection error.');
                throw err;
            });

        SESSION_STORE[sessionId] = p;
    }

    return SESSION_STORE[sessionId];
}

export function getSession(req: interfaces.IOurRequest,
                           res: interfaces.IOurResponse,
                           next: restify.Next): void
{
    createSession(DEFAULT_ID)
        .then((session: blpapi.Session): void => {
            req.log.debug('blpSession retrieved.');
            req.blpSession = session;
            return next();
        }).catch((err: Error): void => {
            req.log.error(err, 'Error getting blpSession.');
            return next(new restify.InternalError(err.message));
        });
}

export function getSocketSession(socket: interfaces.ISocket): Promise<interfaces.ISocket>
{
    return createSession(DEFAULT_ID)
        .then((session: blpapi.Session): interfaces.ISocket => {
            socket.log.debug('blpSession retrieved.');
            socket.blpSession = session;
            return socket;
        }).catch((err: Error): any => {
            socket.log.error(err, 'Error getting blpSession.');
            throw err;
        });
}
