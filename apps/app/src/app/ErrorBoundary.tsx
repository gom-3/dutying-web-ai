import {Component, type ErrorInfo, type ReactNode} from 'react';
import {useLocation} from 'react-router';
import {UnexpectedErrorPage} from '@/pages/error';

type TAppErrorBoundaryProps = {
    children: ReactNode;
    resetKey: string;
};

type TAppErrorBoundaryState = {
    hasError: boolean;
};

class AppErrorBoundaryInner extends Component<TAppErrorBoundaryProps, TAppErrorBoundaryState> {
    state: TAppErrorBoundaryState = {
        hasError: false,
    };

    static getDerivedStateFromError(): TAppErrorBoundaryState {
        return {hasError: true};
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Unhandled app error', error, errorInfo);
    }

    componentDidUpdate(prevProps: TAppErrorBoundaryProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({hasError: false});
        }
    }

    handleRetry = () => {
        this.setState({hasError: false});
    };

    render() {
        if (this.state.hasError) {
            return <UnexpectedErrorPage onRetry={this.handleRetry} />;
        }

        return this.props.children;
    }
}

export function AppErrorBoundary({children}: {children: ReactNode}) {
    const location = useLocation();

    return <AppErrorBoundaryInner resetKey={`${location.pathname}${location.search}`}>{children}</AppErrorBoundaryInner>;
}
