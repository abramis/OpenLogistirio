# Ρύθμιση και ασφάλεια ΑΑΔΕ

Η σύνδεση με ΑΑΔΕ είναι προαιρετική και δεν απαιτείται για την πρώτη εγκατάσταση του Open
Logistirio. Η κανονική Windows εγκατάσταση ξεκινά με περιβάλλον myDATA `test`, απενεργοποιημένες
production αναγνώσεις και απενεργοποιημένες production εγγραφές.

Ο οδηγός αυτός απευθύνεται σε τεχνικό διαχειριστή μαζί με τον υπεύθυνο λογιστή. Οι πραγματικές
production εγγραφές δεν ενεργοποιούνται ως μέρος εγκατάστασης, ενημέρωσης ή smoke test.

## Ποια credentials χρησιμοποιούνται

Το Open Logistirio δεν ζητά, δεν χρειάζεται και δεν πρέπει να αποθηκεύει κωδικούς TAXISnet.

Για myDATA REST API χρειάζονται:

- myDATA REST API username (`aade-user-id`),
- myDATA REST API subscription key (`ocp-apim-subscription-key`),
- επιβεβαίωση ότι υπάρχει η απαιτούμενη εξουσιοδότηση «Διαχείριση Ηλεκτρονικών Βιβλίων», όταν
  χρησιμοποιείται ο API user του λογιστικού γραφείου για πελάτες.

Τα ειδικά credentials της υπηρεσίας «Αναζήτηση Βασικών Στοιχείων Μητρώου Επιχειρήσεων» είναι
διαφορετικά από τα myDATA REST API credentials.

Τα secrets παραμένουν server-side. Δεν τα βάζουμε σε Git, ticket, screenshot, log ή backup report
και δεν τα εμφανίζουμε στον browser. Μετά από αλλαγή secret απαιτείται restart του API.

## myDATA test environment

Στο environment file που χρησιμοποιεί το API, κρατήστε:

```dotenv
AADE_MYDATA_ENV=test
AADE_MYDATA_PRODUCTION_READ_ENABLED=false
AADE_MYDATA_PRODUCTION_ENABLED=false
AADE_MYDATA_USER_ID=your-mydata-api-username
AADE_MYDATA_SUBSCRIPTION_KEY=your-mydata-api-subscription-key
AADE_MYDATA_TIMEOUT_MS=15000
AADE_MYDATA_TEST_SEND_INVOICES_URL=https://mydataapidev.aade.gr/SendInvoices
AADE_MYDATA_TEST_SEND_EXPENSES_CLASSIFICATION_URL=https://mydataapidev.aade.gr/SendExpensesClassification
AADE_MYDATA_TEST_CANCEL_INVOICE_URL=https://mydataapidev.aade.gr/CancelInvoice
AADE_MYDATA_TEST_REQUEST_DOCS_URL=https://mydataapidev.aade.gr/RequestDocs
AADE_MYDATA_TEST_REQUEST_TRANSMITTED_DOCS_URL=https://mydataapidev.aade.gr/RequestTransmittedDocs
AADE_MYDATA_PRODUCTION_SEND_INVOICES_URL=https://mydatapi.aade.gr/myDATA/SendInvoices
AADE_MYDATA_PRODUCTION_SEND_EXPENSES_CLASSIFICATION_URL=https://mydatapi.aade.gr/myDATA/SendExpensesClassification
AADE_MYDATA_PRODUCTION_CANCEL_INVOICE_URL=https://mydatapi.aade.gr/myDATA/CancelInvoice
AADE_MYDATA_PRODUCTION_REQUEST_DOCS_URL=https://mydatapi.aade.gr/myDATA/RequestDocs
AADE_MYDATA_PRODUCTION_REQUEST_TRANSMITTED_DOCS_URL=https://mydatapi.aade.gr/myDATA/RequestTransmittedDocs
```

Οι endpoint τιμές υπάρχουν ήδη ως defaults στην εφαρμογή. Παραμένουν καταγεγραμμένες εδώ για
τεχνικό έλεγχο και δεν πρέπει να αντιγράφονται μηχανικά σε production χωρίς επαλήθευση των
τελευταίων επίσημων οδηγιών της ΑΑΔΕ.

### Ρύθμιση πελάτη στην εφαρμογή

Για την κοινή ροή λογιστικού γραφείου, στον πελάτη επιλέξτε:

- `Με εξουσιοδότηση προς το λογιστικό γραφείο`,
- `Υπάρχει εξουσιοδότηση`, μόνο εφόσον έχει επιβεβαιωθεί πραγματικά,
- `Send to AADE test` μόνο για υποστηριζόμενο εκδοθέν παραστατικό και μόνο στο test environment.

Αν συγκεκριμένος πελάτης πρέπει να χρησιμοποιεί δικό του API user, επιλέξτε
`Με δικά του API credentials από env`, ορίστε ένα ασφαλές env reference όπως
`CLIENT_111222333` και προσθέστε στο server environment:

```dotenv
AADE_MYDATA_CLIENT_111222333_USER_ID=client-mydata-api-username
AADE_MYDATA_CLIENT_111222333_SUBSCRIPTION_KEY=client-mydata-subscription-key
```

Το reference αποθηκεύεται στον πελάτη, αλλά τα ίδια τα credentials όχι. Μην χρησιμοποιείτε ΑΦΜ ή
άλλο αναγνωριστικό ως secret· το reference είναι μόνο όνομα αντιστοίχισης μεταβλητών.

## Υποστηριζόμενες ροές myDATA

Η τρέχουσα υλοποίηση περιλαμβάνει:

- προετοιμασία XML, mock send και guarded test `SendInvoices` για εκδοθέντα παραστατικά πωλήσεων,
- `RequestDocs` και `RequestTransmittedDocs` με αποθήκευση snapshot και reconciliation,
- δημιουργία ελεγχόμενων εισερχόμενων αγορών από reviewed myDATA inbox,
- expense/receiver classification με `SendExpensesClassification?postPerInvoice=true` για αγορά
  που έχει ήδη συσχετιστεί με επίσημο MARK,
- guarded test `CancelInvoice` για εκδοθέν παραστατικό που έχει ήδη MARK,
- ιστορικό προσπαθειών με environment, endpoint, correlation id, failure payload και forced-retry
  marker,
- explicit retry μόνο μετά από προσπάθεια σε κατάσταση `FAILED`· παραστατικό σε κατάσταση `SENT`
  δεν αποστέλλεται δεύτερη φορά,
- αντιστοίχιση cancellation και classification MARKs με το αρχικό τοπικό παραστατικό.

Η συμφωνία χρησιμοποιεί MARK/UID και, όπου χρειάζεται, αριθμό παραστατικού, ημερομηνία, ΑΦΜ και
ποσά. Επισημαίνει έγγραφα που λείπουν, αποκλίσεις ποσών/ημερομηνίας/τύπου/αντισυμβαλλομένου και
επιστρέφει το επίσημο MARK/UID στο τοπικό παραστατικό.

Η καταχώριση παραστατικού καλύπτει τρόπο πληρωμής ΑΑΔΕ, αιτία απαλλαγής ΦΠΑ, παρακρατήσεις, τέλη,
ψηφιακό τέλος συναλλαγής, λοιπούς φόρους και κρατήσεις. Τα πιστωτικά με MARK αρχικού παραστατικού
χαρτογραφούνται ως συσχετισμένα `5.1`, ενώ χωρίς MARK ως μη συσχετισμένα `5.2`.

Πριν από `SendInvoices` ή `SendExpensesClassification`, το backend ελέγχει το XML με τα bundled
official myDATA v2.0.1 XSDs. Μη έγκυρο XML απορρίπτεται τοπικά και δεν αποστέλλεται.

## Production αναγνώσεις και εγγραφές

Η πρόσβαση production είναι χωρισμένη ανά κίνδυνο:

- `AADE_MYDATA_PRODUCTION_READ_ENABLED=true` επιτρέπει μόνο τις read-only κλήσεις `RequestDocs`
  και `RequestTransmittedDocs` όταν το environment είναι production.
- Το read flag δεν επιτρέπει `SendInvoices`, classifications ή cancellations.
- `AADE_MYDATA_PRODUCTION_ENABLED=true` είναι ξεχωριστό write gate.
- Κάθε production write απαιτεί επιπλέον ρητή έγκριση για το συγκεκριμένο παραστατικό ή batch.
- Νέα preview ακυρώνει προηγούμενη έγκριση classification και η έγκριση καταναλώνεται μετά από
  επιτυχημένη αποστολή.

Πριν από οποιαδήποτε production εγγραφή απαιτούνται όλα τα παρακάτω:

1. `AADE_MYDATA_ENV=production`.
2. `AADE_MYDATA_PRODUCTION_ENABLED=true` μόνο για το εγκεκριμένο χρονικό διάστημα.
3. Επανέλεγχος των τελευταίων επίσημων τεχνικών προδιαγραφών, XSDs και URLs.
4. Επιβεβαίωση credentials και εξουσιοδότησης εκτός browser.
5. Φρέσκια προεπισκόπηση και ρητή έγκριση accountant/admin μέσα στην εφαρμογή.

Production αποστολή δεν χρησιμοποιείται ποτέ ως smoke test.

## Προγραμματισμένο read-only sync

Το incremental sync είναι απενεργοποιημένο από προεπιλογή:

```dotenv
MYDATA_SCHEDULED_SYNC_ENABLED=false
MYDATA_SCHEDULED_SYNC_CRON=0 2 * * *
MYDATA_SCHEDULED_SYNC_MAX_PAGES=10
```

Όταν ενεργοποιηθεί, η προεπιλεγμένη έκφραση εκτελείται στις 02:00 `Europe/Athens`, συνεχίζει από
το μεγαλύτερο αποθηκευμένο MARK και κάνει έως τρεις προσπάθειες. Σε production απαιτείται και
`AADE_MYDATA_PRODUCTION_READ_ENABLED=true`. Το scheduled sync είναι μόνο ανάγνωση: δεν εγκρίνει
ούτε αποστέλλει classifications.

## Αναζήτηση στοιχείων Μητρώου ΑΑΔΕ

Η ενέργεια `Ανάκτηση από ΑΑΔΕ` στη φόρμα πελάτη καλεί την επίσημη SOAP υπηρεσία «Αναζήτηση
Βασικών Στοιχείων Μητρώου Επιχειρήσεων» και μπορεί να συμπληρώσει επωνυμία, διακριτικό τίτλο,
ΔΟΥ, διεύθυνση, ενδείξεις καθεστώτος ΦΠΑ/νομικής μορφής, επάγγελμα και ΚΑΔ.

Το λογιστικό γραφείο πρέπει να εγγραφεί στην υπηρεσία με TAXISnet και να δημιουργήσει τα ειδικά
credentials από τη `Διαχείριση Ειδικών Κωδικών`. Στο server environment ορίζονται:

```dotenv
AADE_REGISTRY_USERNAME=your-special-registry-username
AADE_REGISTRY_PASSWORD=your-special-registry-password
AADE_REGISTRY_CALLED_BY_VAT=optional-calling-vat
AADE_REGISTRY_ENDPOINT=https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2
```

Αυτά δεν είναι myDATA credentials και δεν αποθηκεύονται στη βάση ή στον browser.

## Επίσημες πηγές

Πριν από production ενεργοποίηση ελέγξτε ξανά τις τελευταίες εκδόσεις, τα XSDs, τους κανόνες
authentication και τα URLs απευθείας στην ΑΑΔΕ:

- <https://www.aade.gr/mydata>
- <https://www.aade.gr/mydata-ilektronika-biblia-aade/mydata/dokimastiko-periballon>
- <https://www.aade.gr/mydata/tehnikes-prodiagrafes-ekdoseis-mydata>
- <https://www.aade.gr/sites/default/files/2021-07/FAQseggrafi_myDATA_REST_API_02072021.pdf>
- <https://www.aade.gr/anazitisi-basikon-stoiheion-mitrooy-epiheiriseon>
