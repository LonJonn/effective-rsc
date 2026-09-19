'use server-entry';

import 'effect/unstable/schema/SchemaJITCompiler/enable';
import App from 'effective-rsc/application-entry';

import { ServerApplication } from '../server/application';

export default App;

export const HttpLayer = ServerApplication.httpLayer(App);
export const ServerLayer = ServerApplication.serverLayer(App);
