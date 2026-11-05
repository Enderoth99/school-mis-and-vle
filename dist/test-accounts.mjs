import {REPORT_REVIEWER} from './report-config.mjs';
import {teacherByUsername} from './teaching-data.mjs';
export function resolveTestAccount(username){
 if(typeof username!=='string')return null;
 const normalized=username.trim().toLowerCase();
 return normalized===REPORT_REVIEWER.username||normalized==='report.reviewer'?REPORT_REVIEWER:teacherByUsername(normalized)||null;
}
