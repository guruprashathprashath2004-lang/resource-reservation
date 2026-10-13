import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import TeamForm from "@/components/TeamForm";
import DeleteConfirmationForm from "@/components/DeleteConfirmationForm";
import { deleteTeam } from "@/app/actions/teams";

export default async function TeamsPage() {
  await requireAdmin();

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Teams</h1>

      <TeamForm />

      {teams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          No teams yet.
        </p>
      ) : (
        <div className="max-w-xl overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">{t._count.users}</td>
                  <td className="px-4 py-3 text-right">
                    <DeleteConfirmationForm
                      action={deleteTeam}
                      id={t.id}
                      confirmMessage={`Delete "${t.name}"? Its ${t._count.users} member(s) will remain in the system but will no longer belong to a team.`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}