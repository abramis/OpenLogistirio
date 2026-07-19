# Δυνατότητες και γνωστοί περιορισμοί

Το Open Logistirio σχεδιάζεται γύρω από τις καθημερινές ανάγκες μικρού ή μεσαίου ελληνικού
λογιστικού γραφείου. Είναι ανεξάρτητο έργο και δεν αντιγράφει προϊόντα, οθόνες, κείμενα, δομές
βάσης, icons, workflows, branding ή συμπεριφορά ιδιόκτητου λογισμικού.

Η τρέχουσα έκδοση είναι πιλοτική. Πρέπει να δοκιμάζεται παράλληλα με τις υπάρχουσες διαδικασίες
του γραφείου και όχι ως πλήρης αντικατάστασή τους.

## Γραφείο, χρήστες και ασφάλεια

- Πολλαπλές εταιρείες-πελάτες κάτω από ένα λογιστικό γραφείο.
- JWT login/refresh, protected routes και role-based access control (RBAC).
- Αποθηκευμένα και rotating refresh tokens, logout revocation και disabled-user enforcement.
- Failed-login lockout και υποδομή reset token· η πιλοτική production εγκατάσταση δεν εμφανίζει
  self-service reset μέχρι να υπάρχει πραγματική αποστολή email.
- Αλλαγή προσωπικού password από τις ρυθμίσεις χρήστη.
- Admin-only δημιουργία χρηστών και αλλαγή ρόλων γραφείου.
- Tenant-scoped audit trail με φίλτρα χρήστη, ενέργειας και οντότητας.
- Σελίδα `About` με έκδοση/build και επεξήγηση δυνατοτήτων.

## Πελάτες και βασική παραμετροποίηση

- Προφίλ εταιρειών, ατομικών επιχειρήσεων και ελεύθερων επαγγελματιών.
- ΑΦΜ, ΚΑΔ, επάγγελμα, ΔΟΥ, καθεστώς ΦΠΑ, κατηγορία βιβλίων και ρύθμιση myDATA.
- Αντισυμβαλλόμενοι πελάτες και προμηθευτές ανά εταιρεία.
- Ανάκτηση βασικών στοιχείων επιχείρησης από την ειδική υπηρεσία Μητρώου ΑΑΔΕ, όταν έχουν
  ρυθμιστεί τα αντίστοιχα credentials.
- Starter setup templates `Απλογραφικά - ΕΛΠ` και `Διπλογραφικά - ΕΛΠ`.
- Idempotent εφαρμογή templates: η επανάληψη ενημερώνει τους ίδιους κωδικούς αντί να δημιουργεί
  διπλότυπα.
- Setup δεδομένα για κατηγορία βιβλίων, λογαριασμούς, κινήσεις, ημερολόγια, ΦΠΑ, πάγια,
  αποσβέσεις, φορολογικές προσαρμογές και Intrastat placeholders.

Μετά τη δημιουργία πελάτη, η ενέργεια `Παραμετροποίηση` εφαρμόζει το κατάλληλο template. Το
λογιστικό module δημιουργεί επίσης αρχικό σχέδιο λογαριασμών και posting rules ανά πελάτη.

## Παραστατικά και λογιστική

- Μητρώο πωλήσεων, αγορών, πιστωτικών και λιανικής.
- Τρόπος πληρωμής ΑΑΔΕ, αιτία απαλλαγής ΦΠΑ, παρακρατήσεις, τέλη, ψηφιακό τέλος συναλλαγής,
  λοιποί φόροι και κρατήσεις.
- Κωδικοί κίνησης και ημερολόγια ανά παραστατικό και πελάτη.
- CSV/XLSX import με preview, validation, duplicate detection, rollback, ιστορικό και errors ανά
  γραμμή.
- Supporting documents και συσχέτισή τους με τις αντίστοιχες εγγραφές.
- Starter chart of accounts και posting rules ανά πελάτη.
- Manual journal entries, document posting και depreciation posting.
- Accounting periods, trial balance, ledger και financial-statement summaries.
- Revenue/expense books και βιβλίο ΦΠΑ από τα παραστατικά.
- VAT reconciliation και VAT declaration workpapers.

## myDATA

- XML preparation, mock send και guarded AADE test send για εκδοθέντα παραστατικά πωλήσεων.
- RequestDocs/RequestTransmittedDocs snapshots και συμφωνία με τοπικά παραστατικά.
- Office-wide ημερήσιος πίνακας συμφωνίας με pagination, περιλήψεις ανά πελάτη και κοινή ουρά
  εξαιρέσεων.
- Reviewed incoming myDATA inbox με duplicate-safe δημιουργία αγοράς, δημιουργία supplier,
  χειροκίνητο matching, ignored reasons, reviewer timestamps και audit entries.
- Expense/receiver classification για αγορές που έχουν συσχετιστεί με επίσημο MARK.
- Guarded test cancellation για εκδοθέν παραστατικό με MARK.
- Official v2.0.1 XSD validation πριν από invoice ή expense XML send.
- Correlated `5.1` και uncorrelated `5.2` credit-note mapping.
- Αποθήκευση attempt history, environment, endpoint, correlation id, failure payload και forced
  retry marker.
- Failed-only resend policy: εγγραφή `SENT` ή `CANCELLED` δεν αποστέλλεται ξανά ως duplicate.
- Per-client authorization και credential routing.

Οι production αναγνώσεις και εγγραφές είναι χωριστά gated και παραμένουν απενεργοποιημένες από
προεπιλογή. Δείτε τον [αναλυτικό οδηγό ΑΑΔΕ](aade-setup.md).

## Κλείσιμο περιόδων και υποχρεώσεις

- Μηνιαίοι και τριμηνιαίοι period-close έλεγχοι.
- Αυτόματοι έλεγχοι για unposted παραστατικά, ισοζύγιο ημερολογίου, unresolved/failed myDATA,
  αποκλίσεις συμφωνίας και διαθεσιμότητα VAT workpaper.
- Χειροκίνητη επιβεβαίωση δικαιολογητικών.
- Ροή preparer/accountant approval με χρήστες και timestamps.
- Απαίτηση εγκεκριμένου close review πριν από κλείδωμα περιόδου ή έγκριση workpaper.
- Office obligations queue και μηνιαίος generator για myDATA review και υποχρεώσεις ΦΠΑ.
- Tax calendar rules και overrides.

## Πάγια

- Μητρώο παγίων ανά πελάτη.
- Κατηγορίες παγίων και κανόνες αποσβέσεων.
- Αναλογικός υπολογισμός ετήσιας απόσβεσης.
- Δημιουργία λογιστικών εγγραφών απόσβεσης.

## Ψηφιακή διακίνηση και αποθήκη

- Tenant-scoped είδη αποθήκης, αποθήκες και οχήματα.
- Γραμμές δελτίου αποστολής και κωδικοί ποσότητας/σκοπού διακίνησης ΑΑΔΕ.
- Draft, issued, received και cancelled lifecycle.
- Atomic stock deductions και πλήρης, μερική ή απορριφθείσα παραλαβή ανά γραμμή.
- Opening adjustments, cancellation reversals, lifecycle history και signed stock ledger.

Η τρέχουσα ροή είναι εσωτερική λειτουργία αποθήκης/διακίνησης. Δεν υλοποιεί ακόμη αποστολή προς
ΑΑΔΕ ή τις εξωτερικές phase-B lifecycle κλήσεις ψηφιακών δελτίων διακίνησης.

## Αντίγραφα ασφαλείας

- Admin-only δημιουργία, λήψη και επαναφορά database backup από την εφαρμογή.
- Αυτόματο `-pre-restore` safety backup πριν από κάθε restore.
- Production services για περιοδικό, atomic MySQL dump και archive δικαιολογητικών.
- SHA-256 checksums, retention και isolated restore drill.

Τα local Docker volumes και τοπικά backup files δεν είναι off-site backup. Η πραγματική λειτουργία
χρειάζεται ανεξάρτητο, κρυπτογραφημένο αντίγραφο και τακτικά restore drills. Οι τεχνικές
λεπτομέρειες βρίσκονται στο [production runbook](production-runbook.md).

## Γνωστοί περιορισμοί

Δεν έχουν υλοποιηθεί ακόμη:

- μισθοδοσία, υπολογισμοί αποδοχών, ΑΠΔ και ΕΡΓΑΝΗ (ERGANI),
- δηλώσεις εισοδήματος και επίσημη υποβολή φορολογικών δηλώσεων,
- πλήρης TAXISnet/ΓΓΠΣ (GGPS) synchronization και authorization flow,
- πλήρη statutory financial-statement packages και όλες οι production-grade year-end διαδικασίες,
- εξωτερική αποστολή ψηφιακών δελτίων διακίνησης,
- ανεπιφύλακτη production αποστολή myDATA χωρίς νέο έλεγχο προδιαγραφών, credentials και
  εξουσιοδοτήσεων.

Stable production status απαιτεί ακόμη UAT από Έλληνα λογιστή, πραγματικό myDATA test E2E και τα
υπόλοιπα κριτήρια του [release checklist](release-checklist.md).
