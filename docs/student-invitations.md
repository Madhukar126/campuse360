# Student and staff invitations

Admin → Student & staff roster → enter full name, USN/staff login and role → Add & create invitation. The existing authenticated, admin-only roster API generates a random single-use code and stores only its hash; student identity fields remain encrypted. Existing roster entries are skipped, never overwritten.

Copy invitation shares a link on the current site origin. The role, login and code use a URL fragment, so they are not included in HTTP requests or ordinary server logs. Registration reads the fragment, removes it from the current history entry, chooses the role and fills the USN and activation code. The recipient chooses and confirms a 12–128 character password. The invitation itself is a private credential: share it only with the intended recipient. Links expire after seven days and are used once. Passwords and invitation links are not saved to Sheets or browser storage.

Bulk CSV accepts login,name,role columns, an optional header, quoted fields and up to 100 rows, with a preview before import. Student is the default for omitted roles. Admin is never a valid import role. Existing roster entries are skipped. Invitation plaintext is available only in the current admin screen; hide it when finished.

Replacement activation remains under Account management. Choose replacement activation and invitation role, enter the USN, document identity verification and confirm the administrator password. Copy the replacement invitation after generation. The selected role pre-fills registration only; the server verifies the roster role and cannot be overridden by editing an invitation. Existing activated accounts must use recovery instead.

Validation: invitation/CSV unit tests, encryption-aware Edge authorization regression tests, TypeScript and production build. Browser automation is unavailable in this environment, so Safari interaction has not been verified.
