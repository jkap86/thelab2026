import useFetchAllPlayers from "@/hooks/common/useFetchAllplayers";

export default function LineupcheckerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useFetchAllPlayers();

  return <>{children}</>;
}
