export default function JobDashboard() {
  return (
    <div style={{
      minHeight: '100vh', 
      backgroundColor: '#f3f4f6', 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem'}}>
        Job Dashboard - Direct Test
      </h1>
      <p style={{fontSize: '1.2rem', color: '#4b5563'}}>
        This is a completely minimal JobDashboard component with no dependencies.
      </p>
      <div style={{
        marginTop: '2rem', 
        padding: '1rem', 
        backgroundColor: '#dcfce7', 
        border: '1px solid #16a34a',
        borderRadius: '0.5rem'
      }}>
        <p style={{color: '#15803d', fontWeight: 'bold'}}>
          ✅ SUCCESS: JobDashboard component is rendering!
        </p>
        <p style={{color: '#166534', fontSize: '0.9rem', marginTop: '0.5rem'}}>
          If you can see this green box, the component and routing are working correctly.
        </p>
      </div>
    </div>
  );
}