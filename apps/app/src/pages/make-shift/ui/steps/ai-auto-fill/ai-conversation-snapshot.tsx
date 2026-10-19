import {buildConversationSnapshot} from '../../../model/conversation-snapshot';
import type {TResultVersion} from '../../../model/schedule-conversation-api';
import {AiScheduleSnapshotViewer} from './ai-schedule-snapshot-viewer';

type TProps = {
    version: TResultVersion;
    before?: TResultVersion;
    loadBefore?: () => Promise<TResultVersion>;
    returnFocusTo?: HTMLElement | null;
    disabled: boolean;
    onClose: () => void;
    onContinue: (version: TResultVersion) => void;
};

export default function AiConversationSnapshot({version, ...props}: TProps) {
    return (
        <AiScheduleSnapshotViewer
            key={version.versionId}
            {...props}
            after={version}
            toSnapshot={buildConversationSnapshot}
            year={version.year}
            month={version.month}
        />
    );
}
