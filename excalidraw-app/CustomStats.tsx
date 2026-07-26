import { Stats } from "@excalidraw/excalidraw";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { DEFAULT_VERSION, getVersion } from "@excalidraw/common";
import { t } from "@excalidraw/excalidraw/i18n";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { UIAppState } from "@excalidraw/excalidraw/types";

type Props = {
  setToast: (message: string) => void;
  elements: readonly NonDeletedExcalidrawElement[];
  appState: UIAppState;
};
const CustomStats = (props: Props) => {
  const version = getVersion();
  let hash;
  let timestamp;

  if (version !== DEFAULT_VERSION) {
    timestamp = version.slice(0, 16).replace("T", " ");
    hash = version.slice(21);
  } else {
    timestamp = t("stats.versionNotAvailable");
  }

  return (
    <Stats.StatsRows order={-1}>
      <Stats.StatsRow heading>{t("stats.version")}</Stats.StatsRow>
      <Stats.StatsRow
        style={{ textAlign: "center", cursor: "pointer" }}
        onClick={async () => {
          try {
            await copyTextToSystemClipboard(getVersion());
            props.setToast(t("toast.copyToClipboard"));
          } catch {}
        }}
        title={t("stats.versionCopy")}
      >
        {timestamp}
        <br />
        {hash}
      </Stats.StatsRow>
    </Stats.StatsRows>
  );
};

export default CustomStats;
