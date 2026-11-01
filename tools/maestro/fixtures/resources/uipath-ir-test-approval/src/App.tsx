// AUT-1079 のテスト用の最小の Action App。input の note を見せ、comment を受け取り、Approve か Reject で完了する
import { useEffect, useState } from 'react';
import { CodedActionAppService } from '@uipath/coded-action-app';

const service = new CodedActionAppService();
type Data = { note: string; comment: string };

export default function App() {
  const [data, setData] = useState<Data>({ note: '', comment: '' });
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    service.getTask().then((task) => {
      setData({ note: '', comment: '', ...(task.data as Partial<Data>) });
      setReadOnly(task.isReadOnly);
    });
  }, []);

  const edit = (comment: string) => {
    const next = { ...data, comment };
    setData(next);
    service.setTaskData(next);
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 480, overflowWrap: 'anywhere' }}>
      <h1 style={{ fontSize: 18 }}>uipath-ir-test-approval</h1>
      <p>{data.note}</p>
      <label>
        コメント
        <input style={{ display: 'block', width: '100%' }} value={data.comment} readOnly={readOnly} onChange={(e) => edit(e.target.value)} />
      </label>
      <p>
        <button disabled={readOnly} onClick={() => service.completeTask('Approve', data)}>Approve</button>{' '}
        <button disabled={readOnly} onClick={() => service.completeTask('Reject', data)}>Reject</button>
      </p>
    </main>
  );
}
