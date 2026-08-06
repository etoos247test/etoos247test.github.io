import fs from "node:fs";

const path = "firebase-rules/teacher-registration.rules";
let source = fs.readFileSync(path, "utf8");
const marker = "// TEACHER_RECORD_RULES_V1";
if (source.includes(marker)) process.exit(0);

const block = `
    ${marker}
    match /studentScores/{scoreId} {
      allow read: if isMaster()
        || (isTeacher() && hasCampusAccess(resource.data.campus))
        || (isStudent() && resource.data.studentUid == request.auth.uid);

      allow create: if (isMaster()
          || (isTeacher() && canManageStudentInfo() && hasCampusAccess(request.resource.data.campus)))
        && validCampus(request.resource.data.campus)
        && codeMatchesCampus(request.resource.data.studentId, request.resource.data.campus)
        && request.resource.data.studentUid is string
        && request.resource.data.schoolYear is int
        && request.resource.data.updatedBy == request.auth.uid;

      allow update: if (isMaster()
          || (isTeacher() && canManageStudentInfo() && hasCampusAccess(resource.data.campus)))
        && request.resource.data.campus == resource.data.campus
        && request.resource.data.studentId == resource.data.studentId
        && request.resource.data.studentUid == resource.data.studentUid
        && request.resource.data.updatedBy == request.auth.uid;

      allow delete: if isMaster()
        || (isTeacher() && canManageStudentInfo() && hasCampusAccess(resource.data.campus));
    }

    match /counselingRecords/{recordId} {
      allow read: if isMaster()
        || (isTeacher() && hasCampusAccess(resource.data.campus));

      allow create: if (isMaster()
          || (isTeacher() && canManageStudentInfo() && hasCampusAccess(request.resource.data.campus)))
        && validCampus(request.resource.data.campus)
        && codeMatchesCampus(request.resource.data.studentId, request.resource.data.campus)
        && request.resource.data.studentUid is string
        && request.resource.data.counselingDate is string
        && request.resource.data.counselorUid == request.auth.uid
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.updatedBy == request.auth.uid;

      allow update: if (isMaster()
          || (isTeacher() && canManageStudentInfo() && hasCampusAccess(resource.data.campus)))
        && request.resource.data.campus == resource.data.campus
        && request.resource.data.studentId == resource.data.studentId
        && request.resource.data.studentUid == resource.data.studentUid
        && request.resource.data.createdBy == resource.data.createdBy
        && request.resource.data.updatedBy == request.auth.uid;

      allow delete: if isMaster()
        || (isTeacher() && canManageStudentInfo() && hasCampusAccess(resource.data.campus));
    }

`;

const anchor = "    match /auditLogs/{logId} {";
if (!source.includes(anchor)) throw new Error("Firestore rules insertion anchor not found");
source = source.replace(anchor, block + anchor);
fs.writeFileSync(path, source);
