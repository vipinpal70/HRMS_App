# How to migrate database schema

How to migrate database schema to new supabase project
## You can run the Supabase CLI directly using npx without installing it globally:
- npx supabase --help

## To integrate the Supabase CLI into your project, install it as a development dependency:
- npm install supabase --save-dev

## After installation, you can run commands using npx:
- npx supabase start

- npx supabase init

# start docker desktop, and check if the new image is create using - docker ps
## if you failed to open docker then you will get an error:
```console
failed to inspect docker image: error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/public.ecr.aws/supabase/postgres:17.6.1.084/json": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
Docker Desktop is a prerequisite for local development. Follow the official docs to install: https://docs.docker.com/desktop
```
## Login to the supbase account from where you need to migrate the db schema, then go to account prefrence -> access token -> generate toaken and paste here and run this command. This will login to your supabase account via token.
- npx supabase login --token sbp_*************

## Link current project using supabase id and pull schema from your current project
- npx supabase link --project-ref <your-current-project-id>
- npx supabase db pull

## Login with the account where you want to push the schema
- npx supabase login --token sbp_*************

## Push schema
- npx supabase link --project-ref <your-current-project-id>
- npx supabase db push

## When you are finished working on your Supabase project, you can stop the stack (without resetting your local database):
- npx supabase stop