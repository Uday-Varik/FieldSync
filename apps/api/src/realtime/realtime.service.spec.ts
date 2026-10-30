import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  it('emit with no server is a no-op and never throws', () => {
    const svc = new RealtimeService();
    expect(() => svc.emitJobUpdated('c1', 'j1', 'IN_PROGRESS', 2)).not.toThrow();
    expect(() => svc.emitPresence('c1')).not.toThrow();
  });

  it('emit with a server sends job:updated to the company room', () => {
    const emit = jest.fn();
    const server: any = { to: jest.fn().mockReturnValue({ emit }) };
    const svc = new RealtimeService();
    svc.setServer(server);
    svc.emitJobUpdated('c1', 'j1', 'COMPLETED', 3);
    expect(server.to).toHaveBeenCalledWith('company:c1');
    expect(emit).toHaveBeenCalledWith('job:updated', expect.objectContaining({ jobId: 'j1', status: 'COMPLETED', version: 3 }));
  });

  it('presence tracks distinct users per company, not per socket', () => {
    const svc = new RealtimeService();
    svc.trackPresence('c1', 's1', { userId: 'u1', name: 'Ava', role: 'ADMIN' });
    svc.trackPresence('c1', 's2', { userId: 'u1', name: 'Ava', role: 'ADMIN' });
    svc.trackPresence('c1', 's3', { userId: 'u2', name: 'Dan', role: 'DISPATCHER' });
    expect(svc.presenceList('c1')).toHaveLength(2);
    svc.untrackPresence('c1', 's1');
    expect(svc.presenceList('c1')).toHaveLength(2);
    svc.untrackPresence('c1', 's2');
    expect(svc.presenceList('c1')).toHaveLength(1);
  });
});
