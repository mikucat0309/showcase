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
  - size unit is MB
  - date localized
- "Load more" button appends the next page using `nextCursor`
