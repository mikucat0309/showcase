# Web UI

## Tech Stack

- Single page application (SPA)
- Mithril.js
- Daisy UI + Tailwind CSS

## Routing

- `/` → bucket list
- `/:bucket` → object list

## Browse buckets

`GET /`

- Title: `Buckets > :bucket`
- Document title: "Buckets"
- Fetches `/v1/buckets`
- Lists buckets in a table
- click bucket navigates to `/:bucket`

## Browse objects in a bucket

`GET /:bucket`

- Title: `Buckets > :bucket`
- Document title: bucket name
- A filter input at the top of the file table
  - debounce 500 ms
  - filters by object key prefix, resets pagination
- A file table with 3 columns: key, size and last modified
  - size unit auto-selected (B/KiB/MiB/GiB/TiB), rounded up to integer
  - date localized
  - when the bucket config has a `publicEndpoint`, each object is clickable, link to `${publicEndpoint}/${key}` in new tab
- "Load more" button appends the next page using `nextCursor`

## Upload objects

`GET /:bucket` (toolbar)

- "Upload" button opens a multi-file picker
- Per file: `POST /v1/buckets/:bucket/uploads`
- Simple mode: PUT the file to the presigned URL
- Multipart: PUT each slice to its part presigned URL, then `POST .../complete`; on failure `DELETE .../uploads/:id`
- Each upload shows a progress row (name, progress bar / badge / error); the row is removed 3 s after the upload settles (success or failure)
- Refresh object list when upload complete
