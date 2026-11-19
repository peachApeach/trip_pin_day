import * as Notifications from 'expo-notifications'
import { fetchTravelSegments } from '../utils/distanceMatrix'
import { scheduleTripNotifications } from '../utils/notifications'
import type { Trip, TravelSegment } from '../types'

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))
jest.mock('../utils/distanceMatrix', () => ({ fetchTravelSegments: jest.fn() }))

const trip: Trip = {
  id: 1, title: '여행', startDate: '2099-05-01T09:00:00',
  tripStartDate: '2099-05-01T00:00:00', tripEndDate: '2099-05-01T00:00:00',
  travelMode: 'WALKING', segmentModes: {}, segmentDurations: {},
  places: [
    { id: 1, name: '첫 장소', address: '', lat: 37, lng: 127, duration: 30 },
    { id: 2, name: '다음 장소', address: '', lat: 37, lng: 127, duration: 30 },
  ],
}

beforeEach(() => jest.clearAllMocks())

it('이동시간을 불러오는 동안 일정이 바뀌면 기존 알림을 건드리지 않는다', async () => {
  let current = true
  let finishFetch!: (segments: TravelSegment[]) => void
  jest.mocked(fetchTravelSegments).mockReturnValueOnce(new Promise(resolve => { finishFetch = resolve }))

  const pending = scheduleTripNotifications(trip, () => current)
  current = false
  finishFetch([])

  await expect(pending).resolves.toBeNull()
  expect(Notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled()
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
})

it('기존 예약을 교체하던 중 알림을 끄면 나머지 장소의 알림을 만들지 않는다', async () => {
  let current = true
  jest.mocked(fetchTravelSegments).mockResolvedValueOnce([])
  jest.mocked(Notifications.scheduleNotificationAsync).mockImplementationOnce(async () => {
    current = false
    return 'first-notification'
  })

  await expect(scheduleTripNotifications(trip, () => current)).resolves.toBeNull()
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1)
})
