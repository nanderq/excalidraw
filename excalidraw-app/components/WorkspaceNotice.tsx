import { Link } from "react-router-dom";

import { loadExcalifont } from "../excalifont";

import "./WorkspaceNotice.scss";

loadExcalifont();

/** Full-page message for the dead ends around a board: no access, dead link. */
export const WorkspaceNotice = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div className="workspace-notice">
    <div className="workspace-notice__card">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      <Link to="/">Back to your workspaces</Link>
    </div>
  </div>
);
