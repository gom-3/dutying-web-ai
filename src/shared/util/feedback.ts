import toast from 'react-hot-toast';

export function showValidationFeedback(message: string) {
    toast.error(message, {id: 'validation-feedback'});
}

export function showActionErrorFeedback(message: string) {
    toast.error(message);
}
