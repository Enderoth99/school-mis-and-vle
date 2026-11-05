// Reconstruct editable definitions from validated, immutable question snapshots.
export function editableQuestions(questions){return structuredClone(questions).map(q=>{
 if(q.blankAnswers){q.passage=q.passage.replace(/\[\[(\d+)\]\]/g,(_,n)=>'[['+q.blankAnswers[Number(n)-1].join('|')+']]');delete q.blankAnswers;}
 if(q.type==='ranking'){q.options=q.correct.map(i=>q.options[i]);delete q.correct;}
 if(q.type==='matching')q.pairs=q.rows.map((left,i)=>({left,right:q.options[q.correct[i]]}));
 if(q.type==='crossword')q.entries=q.crossword.clues.map((c,i)=>({answer:q.correct[i],clue:c.clue}));
 if(q.type==='sorting')q.groups=q.items.map((item,i)=>({item,category:q.categories[q.correct[i]]}));
 if(q.type==='labels')q.targets=q.targets.map((t,i)=>({...t,label:q.labels[q.correct[i]]}));
 if(q.type==='hotspot')q.hotspots=q.correct;
 if(q.type==='graph')q.pointsKey=q.correct;
 if(q.type==='memory')q.pairs=q.cards.flatMap((left,i)=>q.correct.indexOf(q.correct[i])===i?[{left,right:q.cards[q.correct.lastIndexOf(q.correct[i])]}]:[]);
 return q;
});}
