import { CommandCenterClient } from "@/components/CommandCenterClient";
import { AppShell } from "@/components/AppShell";
import { getUpcomingSponsorMeetings } from "@/app/actions/sponsors";
import { filterSponsorsByProfile, filterTeamNotesByProfile } from "@/lib/access";
import { getServerProfile } from "@/lib/auth-server";
import { getSponsors } from "@/lib/data";
import { readTeamNotes } from "@/lib/team-notes";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const profile = await getServerProfile();
  const [sponsorsRaw, notesRaw, meetings] = await Promise.all([
    getSponsors(),
    readTeamNotes(),
    getUpcomingSponsorMeetings(),
  ]);
  const sponsors = filterSponsorsByProfile(sponsorsRaw, profile);
  const notes = filterTeamNotesByProfile(notesRaw, profile);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1400px]">
        <CommandCenterClient sponsors={sponsors} initialNotes={notes} meetings={meetings} />
      </div>
    </AppShell>
  );
}
