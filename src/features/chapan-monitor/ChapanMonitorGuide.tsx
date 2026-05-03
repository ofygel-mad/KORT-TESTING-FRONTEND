import { useState } from 'react';
import { ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './ChapanMonitorDrawer.module.css';

interface GuideSection {
  title: string;
  route: string;
  who: string;
  body: string;
  steps: string[];
}

const GUIDE: GuideSection[] = [
  {
    title: 'Как создаётся заказ',
    route: '/workzone/chapan/orders',
    who: 'Менеджер заказа',
    body: 'Менеджер открывает раздел «Заказы», заполняет данные клиента, добавляет изделия с параметрами и устанавливает дедлайн.',
    steps: [
      'Нажать «Создать заказ» в разделе «Заказы»',
      'Ввести имя и телефон клиента',
      'Добавить изделия: наименование, размер, количество, цену',
      'Указать дедлайн и способ оплаты',
      'Сохранить — заказ появляется в статусе «Новый»',
    ],
  },
  {
    title: 'Что происходит в Цехе',
    route: '/workzone/chapan/production',
    who: 'Швея / мастер цеха',
    body: 'Когда менеджер подтверждает заказ, задачи попадают в раздел «Цех». Каждая швея видит свои задачи и отмечает их готовность.',
    steps: [
      'Задача появляется в цехе после подтверждения заказа',
      'Швея открывает задачу, шьёт изделие',
      'По готовности нажимает «Готово» напротив задачи',
      'Когда все позиции готовы — заказ переходит в «Готово»',
    ],
  },
  {
    title: 'Как работает раздел «Готово»',
    route: '/workzone/chapan/ready',
    who: 'Менеджер заказа',
    body: 'Готовые заказы ждут отправки на склад. Менеджер формирует накладную кнопкой «На склад».',
    steps: [
      'Заказ появляется после выполнения всех задач в цехе',
      'Менеджер нажимает «На склад» — создаётся накладная',
      'Накладная автоматически подтверждается со стороны цеха',
      'ЗавСклад получает накладную и принимает товар',
    ],
  },
  {
    title: 'Роль склада и накладных',
    route: '/workzone/chapan/warehouse',
    who: 'ЗавСклад / оператор склада',
    body: 'ЗавСклад принимает накладные, проверяет комплектность и подтверждает или отклоняет приёмку.',
    steps: [
      'В разделе «Накладные» появляется новая накладная',
      'ЗавСклад проверяет позиции и их количество',
      'Нажимает «Подтвердить» — товар принят на склад',
      'Или «Отклонить» с указанием причины — менеджер увидит причину в разделе «Готово»',
      'После приёмки заказ готов к отправке',
    ],
  },
  {
    title: 'Отправка и завершение заказа',
    route: '/workzone/chapan/shipping',
    who: 'Менеджер отправки',
    body: 'Менеджер отправки следит за оплатой и отправляет заказы клиентам. После отправки менеджер заказа завершает его.',
    steps: [
      'Менеджер отправки видит заказы в разделе «Отправка»',
      'Проверяет статус оплаты перед отправкой',
      'Нажимает «Отправить» — заказ получает статус «Отправлен»',
      'Менеджер заказа видит кнопку «Завершить заказ»',
      'После подтверждения заказ перемещается в «Завершённые»',
    ],
  },
];

interface Props {
  onClose: () => void;
}

export default function ChapanMonitorGuide({ onClose }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const navigate = useNavigate();

  return (
    <div className={styles.guideList}>
      {GUIDE.map((section, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className={styles.guideSection}>
            <button
              type="button"
              className={styles.guideSectionHeader}
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              <span className={styles.guideSectionTitle}>{section.title}</span>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
            </button>

            {isOpen && (
              <div className={styles.guideSectionBody}>
                <div className={styles.guideWho}>Кто отвечает: {section.who}</div>
                <p className={styles.guideText}>{section.body}</p>
                <ol className={styles.guideSteps}>
                  {section.steps.map((step, j) => (
                    <li key={j} className={styles.guideStep}>{step}</li>
                  ))}
                </ol>
                <button
                  type="button"
                  className={styles.guideNavBtn}
                  onClick={() => { navigate(section.route); onClose(); }}
                >
                  Перейти в этот раздел
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
