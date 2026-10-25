import { startTransition, type FormEvent } from "react";

/**
 * onSubmit handler for a useActionState form. React resets a `<form action>` after every
 * submission — failed validation included — which would wipe a long form on any error.
 * Dispatching from onSubmit skips that reset; call form.reset() yourself on success.
 * The clicked button's name/value (e.g. intent=another) is still posted.
 */
export function submitKeepingValues(dispatch: (formData: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}
