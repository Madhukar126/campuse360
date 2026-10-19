// Fictional developer-authored examples only. No college accounts or complaints.
export const trainingExamples={
 'Water & sanitation':['drinking water purifier filter needs replacement','water tap leaking no supply drinking water','toilet washroom dirty sanitation cleaning sewage','water supply unavailable tap dry since yesterday','bathroom drain blocked dirty washroom toilet'],
 'IT & connectivity':['wifi internet network connection disconnects','computer lab login network server down','library wifi signal weak internet unavailable','campus internet connection slow router offline','computer printer software lab network problem'],
 'Infrastructure':['classroom ceiling fan broken repair','building door window chair desk damaged','classroom lights electrical switch broken','ceiling leaking building wall repair maintenance','stairs lift elevator unsafe building infrastructure'],
 'Academics':['exam timetable schedule marks clarification','lecture syllabus class course faculty academic','assignment grading marks examination results','class schedule lecture cancellation timetable','academic attendance curriculum assessment clarification'],
 'Hostel':['hostel mess food dining quality poor','dorm room hostel accommodation maintenance','hostel laundry common room cleaning','hostel warden accommodation dorm complaint','hostel dining kitchen food meal hygiene'],
 'Boys’ hostel':['boys hostel room accommodation maintenance','boys dormitory hostel room water problem','boys hostel mess food warden complaint','male hostel dorm room repairs','hostel for boys common room maintenance'],
 'Girls’ hostel':['girls hostel room accommodation maintenance','girls dormitory hostel room water problem','girls hostel mess food warden complaint','female hostel dorm room repairs','hostel for girls common room maintenance'],
 'Sports & recreation':['sports playground football cricket equipment','basketball volleyball badminton court net broken','gym sports equipment training athletics','sports ground lights repair cricket practice','recreation indoor games tournament facilities'],
 'Transport':['college bus transport schedule route','bus driver late campus pickup stop','transport bus pass route timetable','college shuttle vehicle bus service delay','bus seats transport timings pickup problem']
};
// Additional fictional campus scenarios; evaluation phrases remain in tests only.
const additionalExamples={
 'Water & sanitation':['tap faucet drip leakage water wastage','sewer sewage drain clog washroom smell','restroom sanitation washroom hygiene cleaning','drinking fountain purifier water access supply','water tank pipe leak sanitation repair'],
 'IT & connectivity':['internet access online portal connection failure','wifi wireless signal coverage poor router','computer PC workstation software printer fault','network cable router ethernet connection drops','wifi connection authentication internet access unavailable'],
 'Infrastructure':['electrical socket wire switch spark maintenance','lift elevator service unavailable building repairs','fan ventilation equipment classroom repairs','desk bench chair furniture damage maintenance','roof wall window door structural damage'],
 'Academics':['semester test exam grades result clarification','assessment assignment evaluation grading correction','course attendance record discrepancy correction','curriculum syllabus subject lecture planning','academic laboratory class teaching schedule clarification'],
 'Hostel':['hostel dormitory residence accommodation concerns','hostel mess dining meal quality hygiene','hostel warden accommodation response delayed','hostel laundry services clothes collection','hostel common room cleanliness maintenance'],
 'Boys’ hostel':['boys hostel residence accommodation concerns','male hostel mess dining meal quality','boys hostel laundry clothes collection','male hostel entrance common room security','boys hostel bathroom hygiene maintenance'],
 'Girls’ hostel':['girls hostel residence accommodation concerns','female hostel mess dining meal quality','girls hostel laundry clothes collection','female hostel entrance common room security','girls hostel bathroom hygiene maintenance'],
 'Sports & recreation':['football pitch field sports drainage maintenance','gym gymnasium treadmill fitness equipment repairs','athletics running track training equipment access','sports recreation game equipment availability','badminton basketball volleyball court floor maintenance'],
 'Transport':['shuttle transport pickup departure timing delay','coach bus route stops service schedule','transport pass application issue renewal','bus shuttle seats vehicle maintenance','transport driver pickup service communication']
};
for(const [category,examples]of Object.entries(additionalExamples))trainingExamples[category].push(...examples);
