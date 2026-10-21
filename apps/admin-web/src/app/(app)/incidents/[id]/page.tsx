export const generateStaticParams = async () => {
  return [];
};

export default function IncidentDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="page">
      <div className="page-head">
        <h1>{params.id}</h1>
      </div>
      <p className="ftc-body">قريب</p>
    </div>
  );
}
