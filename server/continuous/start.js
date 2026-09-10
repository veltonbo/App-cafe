import './server.js';
import { startLocalHistoryMirror } from '../local/history-mirror.js';
import { startLocalMaintenance } from '../local/maintenance.js';

startLocalHistoryMirror();
startLocalMaintenance();
