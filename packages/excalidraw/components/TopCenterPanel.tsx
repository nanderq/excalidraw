import { useTunnels } from "../context/tunnels";

export const TopCenterPanel = ({
  children,
}: {
  children?: React.ReactNode;
}) => {
  const { TopCenterTunnel } = useTunnels();
  return <TopCenterTunnel.In>{children}</TopCenterTunnel.In>;
};

TopCenterPanel.displayName = "TopCenterPanel";
