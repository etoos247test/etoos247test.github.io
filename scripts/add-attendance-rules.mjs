import fs from "node:fs";
import { execFileSync } from "node:child_process";

const path = "firebase-rules/teacher-registration.rules";
const cleanBaseCommit = "330aa7c64b100f0e0fd46ff2b93d42be55f1eb99";
let source = execFileSync("git", ["show", `${cleanBaseCommit}:${path}`], { encoding: "utf8" });
const marker = "// ATTENDANCE_RULES_V1";

const block = `
    ${marker}
    function validAttendanceStudentNo(studentNo) {
      return studentNo is string
        && studentNo.matches('^(00[1-9]|0[1-9][0-9]|1[01][0-9]|120)$');
    }

    function canManageAttendanceRoster(campus) {
      return isMaster()
        || (
          isTeacher()
          && hasCampusAccess(campus)
          && currentUserData().get("canManageStudentInfo", false) == true
        );
    }

    match /attendance/{campus} {
      allow read: if hasCampusAccess(campus);
      allow write: if false;

      match /students/{studentNo} {
        allow read: if hasCampusAccess(campus);

        allow create, update: if canManageAttendanceRoster(campus)
          && validAttendanceStudentNo(studentNo)
          && request.resource.data.campus == campus
          && request.resource.data.studentNo == studentNo
          && request.resource.data.number is int
          && request.resource.data.number >= 1
          && request.resource.data.number <= 120
          && request.resource.data.name is string
          && request.resource.data.name.size() <= 50
          && request.resource.data.updatedBy == request.auth.uid
          && request.resource.data.updatedAt == request.time
          && request.resource.data.updatedByName is string
          && request.resource.data.keys().hasOnly([
            "campus", "studentNo", "number", "name",
            "updatedAt", "updatedBy", "updatedByName"
          ]);

        allow delete: if isMaster();
      }

      match /days/{date} {
        allow read: if hasCampusAccess(campus);
        allow write: if false;

        match /records/{studentNo} {
          allow read: if hasCampusAccess(campus);

          allow create, update: if (isMaster() || isTeacher())
            && hasCampusAccess(campus)
            && validAttendanceStudentNo(studentNo)
            && date.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
            && request.resource.data.campus == campus
            && request.resource.data.date == date
            && request.resource.data.studentNo == studentNo
            && request.resource.data.get("reason", "") is string
            && request.resource.data.get("reason", "").size() <= 200
            && request.resource.data.get("note", "") is string
            && request.resource.data.get("note", "").size() <= 500
            && request.resource.data.get("p1", false) is bool
            && request.resource.data.get("p2", false) is bool
            && request.resource.data.get("p3", false) is bool
            && request.resource.data.get("p4", false) is bool
            && request.resource.data.get("p5", false) is bool
            && request.resource.data.get("p6", false) is bool
            && request.resource.data.get("p7", false) is bool
            && request.resource.data.updatedBy == request.auth.uid
            && request.resource.data.updatedAt == request.time
            && request.resource.data.updatedByName is string
            && request.resource.data.keys().hasOnly([
              "campus", "date", "studentNo", "reason",
              "p1", "p2", "p3", "p4", "p5", "p6", "p7", "note",
              "updatedAt", "updatedBy", "updatedByName"
            ]);

          allow delete: if isMaster() && hasCampusAccess(campus);
        }
      }
    }

`;

const anchor = "    match /auditLogs/{logId} {";
if (!source.includes(anchor)) throw new Error("Firestore rules insertion anchor not found");
source = source.replace(anchor, () => block + anchor);
fs.writeFileSync(path, source);
