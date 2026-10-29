import {useTranslation} from 'react-i18next';
import {Link} from 'react-router';
import {scopePath} from './api';
import {useWardHospitalLinks, wardLinkNeedsReview} from './ward-links';
import './ward-link-notice.css';

export function WardLinkNotice() {
    const query = useWardHospitalLinks();
    const {i18n} = useTranslation();
    const ko = i18n.language.startsWith('ko');
    const pending = query.data?.filter(wardLinkNeedsReview) ?? [];

    if (!query.ownerScope || pending.length === 0) return null;

    const first = pending[0];
    const hospitalName = first.hospitalName?.trim();
    const title = ko ? '확인할 병원 연결 요청이 있어요' : 'A hospital connection needs your review';
    const description =
        pending.length > 1
            ? ko
                ? `${pending.length}건의 요청이 있습니다. 공유 범위와 연결 조건을 확인해 주세요.`
                : `Review the sharing details and connection terms for ${pending.length} requests.`
            : first.status === 'REQUESTED'
              ? ko
                  ? `${hospitalName ?? '병원'}에서 이 병동의 연결을 요청했습니다. 공유 범위를 확인해 주세요.`
                  : `${hospitalName ?? 'A hospital'} has requested a connection. Review what will be shared.`
              : ko
                ? '병원 연결을 위한 계약 동의가 필요합니다. 연결 조건을 확인해 주세요.'
                : 'Review the contract terms before consenting to the hospital connection.';

    return (
        <aside className="ward-link-notice" aria-label={ko ? '병원 연결 요청 안내' : 'Hospital connection notice'}>
            <div className="ward-link-notice-copy">
                <p className="ward-link-notice-title">{title}</p>
                <p className="ward-link-notice-description">{description}</p>
            </div>
            <Link className="ward-link-notice-action" to={scopePath(query.ownerScope, 'links')}>
                {ko ? '요청 확인하기' : 'Review requests'}
            </Link>
        </aside>
    );
}
