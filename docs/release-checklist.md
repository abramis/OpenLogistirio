# Production release checklist

Το checklist ξεχωρίζει μια τεχνικά εγκαταστάσιμη έκδοση από μια έκδοση που μπορεί να δοκιμαστεί
υπεύθυνα σε πραγματικό ελληνικό λογιστικό γραφείο.

## Υποχρεωτικά πριν από release candidate

- Καθαρό Git worktree, ενημερωμένο changelog και version που συμφωνεί με το tag.
- `npm ci` και `npm run release:check` επιτυχή στο ακριβές release commit.
- Production Docker images χτίζονται από το ίδιο commit.
- Νέα εγκατάσταση: migrations, production bootstrap, login και smoke check επιτυχή.
- Upgrade αντιγράφου πραγματικής βάσης και isolated restore drill επιτυχή.
- Κανένα secret, πραγματικό ΑΦΜ, subscription key ή backup μέσα στο Git/artifact.
- Όλα τα AADE production-write flags παραμένουν `false`.
- High/critical runtime dependency audit καθαρό ή τεκμηριωμένη αποδοχή κινδύνου.

## Υποχρεωτικά πριν από stable production release

- Rotation κάθε credential που έχει εμφανιστεί σε συνομιλία, log ή μη ασφαλές αρχείο.
- Έλεγχος από Έλληνα λογιστή για αποσβέσεις, tax calendar, year-end close και workpapers.
- UAT από τουλάχιστον ένα γραφείο με ανωνυμοποιημένο αντίγραφο δεδομένων και καταγεγραμμένα
  αποτελέσματα για αγορές, πωλήσεις, πιστωτικά, ακυρώσεις, ΦΠΑ, imports και period close.
- Πραγματικό myDATA test E2E για εισερχόμενο MARK και expense classification στο test environment.
- Τεκμηριωμένη διαδικασία αναβάθμισης, rollback και υποστήριξης incident.
- Επιτυχημένο deployment με TLS, monitoring, off-site encrypted backups και restore drill.
- Γραπτή λίστα γνωστών περιορισμών: δεν υπάρχουν ακόμη payroll/APD/ERGANI, επίσημες υποβολές
  δηλώσεων ή πλήρης TAXISnet/ΓΓΠΣ ροή.

## Κανόνας δημοσίευσης

Tag, GitHub release και container images δημιουργούνται μόνο από commit που πέρασε το checklist.
Production αποστολή προς ΑΑΔΕ δεν αποτελεί smoke test και δεν ενεργοποιείται από release/deploy.
