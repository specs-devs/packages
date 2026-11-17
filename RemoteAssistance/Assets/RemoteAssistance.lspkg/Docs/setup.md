# RemoteAssistance setup

[← Agent usage index](../README.md)

## Use when

Connect the package to your Snap Cloud project.

## Steps

1. **Credentials**: In Lens Studio, open **Window → Supabase**, sign in, then create or import a project and click **Import Credentials**. Assign the resulting `SupabaseProject` asset to **Supabase Project** on the `SnapCloudRequirements` object (first child of the prefab). Every script reads the project from there: `SnapCloudModule.snapCloudRequirements` is wired to it in the prefab, and RtcMailbox gets it from SnapCloudModule. Don't paste URLs or keys into scripts.
2. **Credentials needed panel**: The prefab ships with the project empty, so a fresh install first shows a red-framed **Credentials needed** panel (`CredentialsWarning`) listing what is missing. "Continue without credentials" closes it and the guide appears; calls then can't signal. Once the project is assigned, the panel doesn't appear. This package uses no Remote Service Gateway tokens.
3. **Database**: Apply the schema once (`supabase db push`), see [Guide](guide.md#setup--build). The migrations live in `supabase/` at the RemoteAssistance project root, outside `RemoteAssistance.lspkg`, so an Asset Library import doesn't include them; obtain those companion files separately.
4. **Helper portal**: see [Helper portal](helper-portal.md).

Older scenes that still carry the `SupabaseRequirements` component keep working: it is deprecated and only read when SnapCloudModule's `snapCloudRequirements` isn't wired.
