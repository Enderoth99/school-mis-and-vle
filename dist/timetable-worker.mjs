import {generateTimetable} from './timetable-engine.mjs';
self.onmessage=({data})=>{try{self.postMessage({ok:true,...generateTimetable(data.project,data.options)});}catch(error){self.postMessage({ok:false,error:error.message});}};
